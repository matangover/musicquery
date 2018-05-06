# Demo
1. Open [Verovoi Humdrum Viewer](http://verovio.humdrum.org/).
2. Save the content to a local file, `mozart_sonata.krn`.
2. Extract the top voice from the top staff:
```
extractx -s 2a -mr mozart_sonata.krn > mozart_melody.nkrn
```
3. Open a search shell:
```shell
ipython -i extract.py mozart_melody.nkrn
```
3. Run the search function:
```python
f(siciliana)
```

4. Paste the result into Verovio Humdrum Viewer.
5. Explore other patterns: `sharps`, `stacc`, `edc`, `aba`, `first_note_of_measure`
