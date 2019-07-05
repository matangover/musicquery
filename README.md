# MusicQuery
A notation-based query language for symbolic music. [Try it](http://www.matangover.com/musicquery)!

![MusicQuery screenshot](/screenshot.png?raw=true)

## Query language
The query language is inspired by text regular expressions. A search query is expressed as musical notation.
The query is encoded in [MEI](http://music-encoding.org/). A query is a subset of a normal score, with some specific query semantics.
### Query semantics
A query must be a valid MEI excerpt contains any of the following elements.

#### `<note>`
Matches one note. Duration (`dur`), pitch name (`pname`), octave (`oct`) and accidentals (`accid`) are taken into account.
* Accidentals must always be spelled out (a key signature of C major is assumed).
* `query:any-duration="true"` matches any accidental, that is - any pitch with the specified note name and octave.
* `query:any-pitch="true"` matches any pitch, that is, any note with the specified duration.
* `query:any-duration="true"` matches any duration, that is, any note with the specified pitch.

#### `<query:or>`
Indicates an "or" operator (translates to the `|` regular expression operator). Rendered as a vertical line on the staff.

#### `<query:group>`
Used for grouping and quantifying. Corresponds to parentheses and quantifiers in regular expression. Can contain any other query element, including nested `<query:group>`s.

Attributes `min-occurrences` and `max-occurrences` specify how many occurrences the group will match. For now only values that map to regular expression quantifiers `*` (zero or more), `+` (one or more), and `?` (zero or one) are supported.

Set `bracket.visible="false"` if you wish to hide a group's bracket.

#### `<space>`
Ignored. Can be used to adjust spacing for nicer rendering.
Example:
```xml
<space dur="8" />
```

#### `<beam>`
Ignored. Can be used to adjust beaming for nicer rendering. Can contain `<note>` elements.
Example:
```xml
<beam>
    <note pname="c" oct="5" dur="8" dots="1" accid="s"/>
    <note pname="d" oct="5" dur="16" />
    <note pname="c" oct="5" dur="8" accid="s"/>
</beam>
```

## Algorithm
The query is translated behind the scenes to a regular expression and executed on a score that is encoded in the [Humdrum ****kern representation](https://musiccog.ohio-state.edu/Humdrum/representations/kern.html).

The regular expression itself is complicated. It is possible to hand craft an expression, but it is error prone. For example, the following easy to read music query:
```xml
<note dur="8" dots="1" query:duration-only="true" />
<note dur="16" query:duration-only="true" />
<note dur="8" query:duration-only="true" />
<query:group min-occurrences="0" max-occurrences="1" bracket.visible="false">
    <note pname="e" oct="5" dur="4" />
</query:group>
```

is translated to the following monstrous regular expression:
```
(^|\t)(&?{)?(&?\()?\[?8\.([a-g]+|[A-G]+)(#+|-+|n)?(?![a-gA-G#\-n]).*
(^[!.*=].*
)*?(^|\t)(&?{)?(&?\()?\[?16([a-g]+|[A-G]+)(#+|-+|n)?(?![a-gA-G#\-n]).*
(^[!.*=].*
)*?(^|\t)(&?{)?(&?\()?\[?8([a-g]+|[A-G]+)(#+|-+|n)?(?![a-gA-G#\-n]).*
(^[!.*=].*
)*?((^|\t)(&?{)?(&?\()?\[?4ee(?![a-gA-G#\-n]).*
(^[!.*=].*
)*?)?
```

## Rendering
The query and score are rendered to SVG in the browser using [Verovio](http://www.verovio.org/). Verovio supports both MEI (for the query) and Humdrum (for the score). Search results are highlighted in the score using a Humdrum marker that is added to matched lines.

Since Verovio doesn't support all the features needed to render a query, some extra patches are added to the rendered SVG after Verovio renders it.


## Future work
This project is a proof-of-concept. A lot of work has been done previously on symbolic music searching, but I have not encountered a graphical music query language. The target audience of this language is musicologists, however, in its current state the language is of limited use to them. The following should be implemented.

* Polyphonic music support. Regular expressions are powerful enough to support polyphonic music searching in the Humdrum format. However, the semantics of the query language are hard to define. I would like to explore two approaches:
  1. Preprocess a two-voice Humdrum score using `hint` and `mint` (harmonic and melodic intervals), and define query operators which operate on that. (Scores with more than two voices can be processed in pairs of voices.)
  2. Use a constraint-based system based on Structured Polyphonic Patterns (by Mathieu Bergeron). Define graphical query operators that translate to that language and implement the search engine.


* The query language itself should be extended to support:
  - Chords.
  - Additional "layers" of searching: e.g., harmony, dynamics, articulation, which can be added as constraints. (E.g., find an A only on subdominant or dominant chords.)
  - Chroma and pitch class (octave invariance).
  - Transposition invariance (melodic intervals).
  - 'Any note' (any pitch and any rhythm).
  - Rests (including wildcards - "any rest").


* Users should be able to input a query using a graphical interface. The interface could be based on [Vida.js](https://github.com/DDMAL/vida.js) or [nCoda](https://ncodamusic.org/) (both are open source projects with a web-based notation editor).


* Rendering should be improved. Right now, Verovio is used in a patchy way because it doesn't support all the needed rendering features.
   - Support for rhythmic notation (instead of tenuto). This will be possible when Verovio supports custom noteheads (`head.shape`, see [PR](https://github.com/rism-ch/verovio/pull/460)).
   - A custom 'OR' symbol (dashed vertical line) should be rendered.
   - A bracket object supporting arbitrary text should be added. It should be similar to a slur object rather than a tuplet, but look like a tuplet.


* Rigorous tests should be added.
