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
  $("#input").on("input", function() {
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
  $("#reset").click(function() {
    $.get("/scores/mozart_melody.krn", function(data) {
      $("#humdrum-input").val(data);
      render(data, $("#humdrum-output"));
    });
  });
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
    throw new Error("Found " + section.length + " layers instead of 1.");
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

var RECORD_START = "(^|\\t)";
// Skip lines starting with:
//  . - null record.
//  ! - comment.
//  * - interpretation / tandem interpretation
//  = - barline
var OPTIONAL_SKIPPED_LINES = "(^[!.*=].*\n)*?";
var OPTIONAL_SLUR_START = "(&?{)?(&?\\()?\\[?";
var ANY_ACCIDENTAL = "(#+|-+|n)?";
var getRegexFor = {
  beam: getRegexForChildren,
  note: function (element) {
    var duration = getNoteDuration(element);
    var pitch = getNotePitch(element);
    // https://musiccog.ohio-state.edu/Humdrum/representations/kern.html#Context%20Dependencies
    return RECORD_START + OPTIONAL_SLUR_START + duration + pitch + ".*\n" + OPTIONAL_SKIPPED_LINES;
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
  var pattern = meiToRegex();
  var data = $("#humdrum-input").val();
  console.log(pattern);
  // Multiline regex - treat "^" as "start of line" rather than "start of
  // string".
  var regex = new RegExp(pattern, "gm");
  var dataLines = data.split("\n");
  var outputLines = dataLines.slice();
  while ((match = regex.exec(data)) !== null) {
    console.log("Match!", match.index, regex.lastIndex);
    var startLine = getLineIndex(match.index, dataLines);
    var endLine = getLineIndex(regex.lastIndex - 2, dataLines);
    for (var lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
      if (outputLines[lineIndex][0] != ".") {
        outputLines[lineIndex] += "@";
      }
    }
  }
  // Remove empty lines (invalid in Humdrum).
  outputLines = outputLines.filter(function(line) {
    return line != "";
  });
  outputLines.push("!!!RDF**kern: @ = marked note");
  $("#humdrum-input").val(outputLines.join("\n"));
  render($("#humdrum-input").val(), $("#humdrum-output"));
}

function getLineIndex(characterIndex, lines) {
  var characters = 0;
  for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    // +1 to account for the \n.
    characters += lines[lineIndex].length + 1;
    if (characterIndex + 1 <= characters) {
      return lineIndex;
    }
  }
  throw new Error("Character index greater than string length.");
}
