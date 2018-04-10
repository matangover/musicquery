import sys
import re
import subprocess

def write_to_clipboard(output):
    process = subprocess.Popen(
        'pbcopy', env={'LANG': 'en_US.UTF-8'}, stdin=subprocess.PIPE)
    process.communicate(output)

# Input must be only one spine (with no sub-spines)
# To generate, use:
# extractx -s $1 -mr mozart_sonata.krn > newfile.nkrn
# Where $1 is e.g. 1a, 1b, 2a, 2b (spine and subspine).

input_filename = "mozart_melody2.nkrn"
input_file = open(input_filename)
# data = re.sub(r"[JL]", "", data) # remove stem information
# TODO - measure boundaries
# Get rid of unwanted lines - like ridx but while keeping a line map for later
line_map = []
data = ""
original_line = 0
for line in input_file:
    original_line += 1
    if not line: # empty line
        continue
    if line[0] in ("*", "!", "."):
        continue
    data += line
    line_map.append(original_line)

siciliana = r"""
_8\.\p.+
_16\p.+
_8\p.+
"""

sharps = "#"

first_note_of_measure = r"""
^=.*
(.+)
"""

edc = r"""
.+[eE].+
(?:.|\n)+?
.+[dD].+
(?:.|\n)+?
.+[cC].+
"""

aba = r"""
.+(\p).+
.+\p.+
.+\1.+
"""

stacc = "'"

def preprocess_pattern(pattern):
    # remove aesthetic newline if exists
    if pattern[0] == "\n":
        pattern = pattern[1:]
    # remove aesthetic newline if exists
    if pattern[-1] == "\n":
        pattern = pattern[:-1]
    # rhythm matching - allow slur, require beginning of line
    pattern = pattern.replace("_", "^\(?")
    # match any collection of notes - minimal (non-greedy)
    # pattern = pattern.replace(r"\a", "(.|\n)+?")
    # match any pitch (not a rest)
    pattern = pattern.replace(r"\p", r"[a-gA-G]+[#\-]?") # todo double sharp, flat
    return pattern


def f(pattern):
    p = preprocess_pattern(pattern)
    print p
    results = re.finditer(p, data, re.MULTILINE)
    input_lines = open(input_filename).readlines()
    for m in results:
        result_start = get_original_line_number(m.start())
        result_end = get_original_line_number(m.end())
        print "%s-%s" % (result_start, result_end) # line numbers are 1-based
        for result_line in range(result_start-1, result_end):
            if input_lines[result_line].startswith("."): # Don't add marker to null row
                continue
            input_lines[result_line] = input_lines[result_line][:-1] + "@\n"

    # Humdrum doesn't like empty lines
    if input_lines[-1][-1] == "\n":
        del input_lines[-1]

    input_lines.append("!!!RDF**kern: @ = marked note") # mark in red in VHV
    open(input_filename+".marked", "w").writelines(input_lines)
    write_to_clipboard("".join(input_lines))

def get_original_line_number(offset):
    new_line_number = data.count("\n", 0, offset)
    return line_map[new_line_number]

# print re.findall(preprocess_pattern(siciliana), data, re.MULTILINE) # | re.DOTALL)
f(siciliana)
