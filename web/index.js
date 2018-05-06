var vrvToolkit;

function render(data, output) {
  try {
    scale = 40;
    var svg = vrvToolkit.renderData(data, {
      pageHeight: output.height() / (scale / 100),
      pageWidth: output.width() / (scale / 100),
      scale: scale
    });
  } catch (e) {
    console.log(e);
  }
  output.html(svg);
  // $("#output svg").width("100%").height("100%");
}

$(function() {
  vrvToolkit = new verovio.toolkit();
  $("#input").on("input change", function() {
    render($("#input").val(), $("#output"));
  });
  $("#humdrum-input").on("input", function() {
    render($("#humdrum-input").val(), $("#humdrum-output"));
  });
  $.get("/patterns/siciliana.mei", function(data) {
    $("#input").val(data);
    render(data, $("#output"));
  });
  $.get("/scores/mozart_melody.krn", function(data) {
    $("#humdrum-input").val(data);
    render(data, $("#humdrum-output"));
  });
  $("#search").click(search);
});
$(window).resize(function() {
  render($("#input").val(), $("#output"));
  render($("#humdrum-input").val(), $("#humdrum-output"));
});

function meiToRegex() {
  var meiText = $("#input").val();
  var meiPattern = $($.parseXML(meiText));
  var layer = meiPattern.find("music body mdiv score section measure staff layer");
  if (layer.length != 1) {
    throw new Exception("Found " + section.length + " layers instead of 1.");
  }
  var regex = getRegexForChildren(layer);
  return regex;
}

function getRegexForChildren(element) {
  var regex = "";
  element.children().each(function (index, el) {
    var tag = $(el).prop("tagName").toLowerCase();
    regex += getRegexFor[tag]($(el));
  });
  return regex;
}

var RECORD_START = "^|\\t";
// Skip lines starting with:
//  . - null record.
//  ! - comment.
//  * - interpretation / tandem interpretation
//  = - barline
var OPTIONAL_SKIPPED_LINES = "(^[!.*=].*\n)*";
var OPTIONAL_SLUR_START = "(&?{)?(&?\\()?\\[?";
var ANY_ACCIDENTAL = "(#+|-+|n)?";
var getRegexFor = {
  beam: getRegexForChildren,
  note: function (element) {
    var duration = getNoteDuration(element);
    var pitch = getNotePitch(element);
    // https://musiccog.ohio-state.edu/Humdrum/representations/kern.html#Context%20Dependencies
    return OPTIONAL_SKIPPED_LINES + RECORD_START + OPTIONAL_SLUR_START + duration + pitch + ".*\n";
  },
  tuplet: function (element) {
    // TODO: Handle actual tuplets (those not signifying grouping).
    var childrenRegex = getRegexForChildren(element);
    var quantifier = element.attr("quantifier") || "";
    return "(" + childrenRegex + ")" + quantifier;
  },
  beatRpt: function (element) {
    return "|";
  }
};

function getNoteDuration(element) {
  if (element.attr("stem.visible") == "false") {
    // Allow any duration - query specifies pitch only.
    // https://musiccog.ohio-state.edu/Humdrum/representations/kern.html#Duration
    return "[0-9]+\\.*";
  } else {
    // http://music-encoding.org/guidelines/v3/data-types/data.duration.cmn.html
    var meiDuration = element.attr("dur");
    var dotCount = parseInt(element.attr("dots")) || 0;
    var dots = "\\.".repeat(dotCount);
    return meiDuration + dots;
  }
}

function getNotePitch(element) {
  // https://musiccog.ohio-state.edu/Humdrum/representations/kern.html#Pitch
  if (element.attr("artic") == "ten") {
    // Allow any pitch - query specifies duration only.
    var pitchName = "([a-g]+|[A-G]+)";
    var accidental = ANY_ACCIDENTAL;
  } else {
    var oct = parseInt(element.attr("oct")) || 4;
    var meiPitchName = element.attr("pname");
    if (oct >= 4) {
      var pitchName = meiPitchName.repeat(oct - 3);
    } else {
      var pitchName = meiPitchName.toUpperCase().repeat(4 - oct);
    }
    var meiAccidental = element.attr("accid") || "";
    if (meiAccidental == "1qs") {
      var accidental = ANY_ACCIDENTAL;
    } else {
      // http://music-encoding.org/guidelines/v3/data-types/data.accidental.explicit.html
      var accidental = meiAccidental.replace("n", "")
        .replace("s", "#").replace("f", "-").replace("x", "##");
    }
  }
  return pitchName + accidental;
}

function search() {
  var regex = meiToRegex();
}
