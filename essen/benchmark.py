import re
from pathlib import Path
from glob import iglob
import os
from collections import defaultdict
from typing import DefaultDict
import time
import itertools

# The Essen Folksong Collection can be downloaded from KernScores:
# http://kern.ccarh.org/cgi-bin/ksbrowse?l=/essen
# The collection contains 8473 folk songs (monophonic) encoded in .krn files.
essen_dir = os.path.expanduser('~/Downloads/essen')

def main():
    with open(Path(__file__).parent / 'siciliana_pattern.txt') as pattern_file:
        pattern = re.compile(pattern_file.read(), re.MULTILINE)

    matches: DefaultDict[str, list] = defaultdict(list)

    print('Searching...')
    timer = time.process_time
    start_time = timer()
    for krn_filename in iglob(f'{essen_dir}/**/*.krn', recursive=True):
        with open(krn_filename, encoding='latin-1') as krn_file:
            krn = krn_file.read()
            for match in pattern.finditer(krn):
                matches[krn_filename].append(match)

    elapsed = timer() - start_time
    print(f'Done. Process time elapsed: {elapsed}')

    total_matches = sum(len(file_matches) for file_matches in matches.items())
    total_files = len(matches.keys())
    print(f'Found {total_matches} matches in {total_files} files.')
    
    print('\nExample matches:\n')
    for filename, file_matches in itertools.islice(matches.items(), 2):
         print(filename)
         for match in file_matches[:2]:
             print(f'  {match.start()} - {match.end()}')
             print(match.group())

if __name__ == '__main__':
    main()
