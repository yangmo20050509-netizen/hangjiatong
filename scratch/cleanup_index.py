import os

path = r'C:\Users\18550\Desktop\暑期实习\hangjiatong\index.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 216 is index 215. Line 967 is index 966.
# We want to keep up to line 215 (index 214)
# And from line 968 (index 967) onwards.
new_lines = lines[:215] + [
    '  <script src="js/data.js"></script>\n',
    '  <script src="js/app.js"></script>\n'
] + lines[967:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully updated index.html")
