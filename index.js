var vrvToolkit;
var symbolDefinitions = "";
var initialScore = null;

function render(data, output) {
  try {
    scale = 40;
    var container = output.closest(".score-container");
    var svg = vrvToolkit.renderData(data, {
      pageHeight: container.height() / (scale / 100),
      pageWidth: container.width() / (scale / 100),
      scale: scale
    });
  } catch (e) {
    console.log(e);
  }
  output.html(svg);
  // $("#output svg").width("100%").height("100%");
  renderCustomElements(output);
}

function renderCustomElements(output) {
  var svg = output.children("svg");
  addCustomSymbolDefinitions(svg);
  svg = output.children("svg");
  svg.find(".tuplet.quantifier").each(function(index, quantifier) {
    $quantifier = $(quantifier);
    var regexQuantifier = vrvToolkit.getElementAttr($quantifier.attr("id")).quantifier;
    var minimum = (regexQuantifier == "?" || regexQuantifier == "*") ? 0 : 1;
    var maximum = regexQuantifier == "?" ? 1 : null;
    // #E88A is the colon.
    var digits = $quantifier.children("use[xlink\\:href!='#E88A']");
    alterDigit($(digits[0]), minimum);
    alterDigit($(digits[1]), maximum);
  });
}

function alterDigit(digit, newValue) {
  // https://w3c.github.io/smufl/gitbook/tables/tuplets.html
  if (newValue === null) {
    digit.remove();
  } else {
    digit.attr("xlink:href", "#E88" + newValue);
  }
}

function addCustomSymbolDefinitions(svg) {
  svg.find("defs").append(symbolDefinitions);
  svg.parent().html(svg.parent().html());
}

$(function() {
  vrvToolkit = new verovio.toolkit();
  initializeSymbolDefinitions();
  $("#input").on("input", function() {
    render(getPattern(), $("#output"));
  });
  $("#humdrum-input").on("input", function() {
    render($("#humdrum-input").val(), $("#humdrum-output"));
  });
  loadPattern("patterns/mozart/siciliana.mei", false);
  $.get("scores/mozart_melody.krn", function(data) {
    initialScore = data;
    $("#humdrum-input").val(data);
    render(data, $("#humdrum-output"));
  });
  $("#search").click(search);
  $("#clear").click(clear);

  $(".pattern-examples .dropdown-item").click(function () {
    var pattern = $(this).data("target");
    loadPattern(pattern, true);
    $(this).parent().children(".dropdown-item.active").removeClass("active");
    $(this).addClass("active");
  });
});
$(window).resize(function() {
  render($("#input").val(), $("#output"));
  render($("#humdrum-input").val(), $("#humdrum-output"));
});

function meiToRegex() {
  var meiText = getPattern();
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
// Use non-greedy operator (*?) so that rows are only captured if necessary to
// satisfy the pattern.
var OPTIONAL_SKIPPED_LINES = "(^[!.*=].*\n)*?";
var OPTIONAL_SLUR_START = "(&?{)?(&?\\()?\\[?";
var ANY_ACCIDENTAL = "(#+|-+|n)?";
var getRegexFor = {
  beam: getRegexForChildren,
  note: function (element) {
    if (element.attr("type") == "or") {
      return getRegexForOr();
    }
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
  space: function () { return ""; }
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
  // Ensure we're matching the whole note by adding a negative lookahead.
  return pitchName + accidental + "(?![a-gA-G#\\-n])";
}

function getRegexForOr(element) {
  return "|";
}

function search() {
  clear();
  try {
    var pattern = meiToRegex();
  } catch (e) {
    console.log(e);
    alert('Invalid query.');
    return;
  }
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

function initializeSymbolDefinitions() {
  var symbols = ["E880-tuplet0.xml", "E881-tuplet1.xml"];
  for (var i = 0; i < symbols.length; i++) {
    $.ajax({
      url: "resources/symbols/" + symbols[i],
      dataType: "text",
      success: function(data) {
        symbolDefinitions += data;
      }
    });
  }
}

function clear() {
  if (initialScore === null) {
    return;
  }

  $("#humdrum-input").val(initialScore);
  render(initialScore, $("#humdrum-output"));
}

function loadPattern(pattern, doSearch) {
  $.get(pattern, function(data) {
    $("#input").val(data);
    render(getPattern(), $("#output"));
    if (doSearch) {
      search();
    }
  });
}

function getPatternContent(pattern) {
  var patternDoc = $($.parseXML(pattern));
  var layer = patternDoc.find("music body mdiv score section measure staff layer");
  var serialized = (new XMLSerializer()).serializeToString(layer[0]);
  var lines = serialized.split("\n");
  var contentLines = lines.slice(1, lines.length - 1);
  var numLeadingSpaces = contentLines.map(function (line) {
    return line.search(/[^ ]|$/);
  });
  var minLeadingSpaces = numLeadingSpaces.reduce(function(a, b) {
    return Math.min(a, b);
  });
  var unindentedLines = contentLines.map(function (line) {
    return line.substring(minLeadingSpaces);
  });

  return unindentedLines.join("\n");
}

function getPattern() {
  var patternContent = $("#input").val();
  var fullPattern = PATTERN_TEMPLATE.replace("PATTERN", patternContent);
  return convertToMEI(fullPattern);
}

function convertToMEI(patternText) {
  try {
    var pattern = $($.parseXML(patternText));
  } catch (e) {
    // Invalid query XML. Do nothing.
    return patternText;
  }
  pattern.find('note').each(function (index, note) {
    note = $(note);
    if (note.attr('query:any-duration') === 'true') {
      note.attr('stem.visible', 'false');
      if (note.attr('dur') === undefined) {
        note.attr('dur', '4');
      }
    }
    if (note.attr('query:any-pitch') === 'true') {
      note.attr('artic', 'ten');
      if (note.attr('pname') === undefined && note.attr('oct') === undefined) {
        note.attr('pname', 'c');
        note.attr('oct', '5');
      }
    }
    if (note.attr('query:any-accidental') === 'true') {
      note.attr('accid', '1qs');
    }
  });
  pattern.find('query\\:or').each(function (index, or) {
    or = $(or);
    var orNote = $('<note type="or" pname="f" dur="4" oct="4" stem.len="6" />');
    or.replaceWith(orNote);
  });
  pattern.find('query\\:group').each(function (index, group) {
    group = $(group);
    var tuplet = $('<tuplet num="1" numbase="1" num.format="ratio" />');
    //  bracket.visible="false"
    tuplet.attr('xml:id', 'group' + index);
    tuplet.append(group.children());
    var min = group.attr('min-occurrences');
    var max = group.attr('max-occurrences');
    var quantifier = '';
    if (min === undefined && max === undefined) {
      tuplet.attr('num.visible', 'false');
    } else {
      tuplet.attr('type', 'quantifier');
      var quantifier = '';
      if (min === '0' && max === '1') {
        quantifier = '?';
      } else if (min === '1' && max === undefined) {
        quantifier = '+';
      } else {
        quantifier = '*';
        if (!(min === '0' && max === undefined)) {
          console.log('Quantifiers {' + min + ', ' + max + '} not supported.' +
            'Using "zero or more" instead.');
        }
      }
      tuplet.attr('quantifier', quantifier);
    }
    tuplet.attr('bracket.visible', group.attr('bracket.visible'));
    group.replaceWith(tuplet);
  });
  return (new XMLSerializer()).serializeToString(pattern[0]);
}