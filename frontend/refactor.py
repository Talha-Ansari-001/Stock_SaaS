import os
import re

directory = r'D:\saas-inventory\frontend\src'

color_map = {
    'bg-[#0d0d11]': 'bg-base',
    'bg-[#13131a]': 'bg-panel',
    'bg-[#1b1b24]': 'bg-surface',
    'bg-[#1e1e28]': 'bg-surface-hover',
    'bg-[#16161f]': 'bg-surface-hover', # fallback
    'border-[#22222b]': 'border-border-subtle',
    'border-[#2e2e3a]': 'border-border-subtle',
    'text-gray-100': 'text-text-primary',
    'text-white': 'text-text-primary',
    'text-gray-300': 'text-text-secondary',
    'text-gray-400': 'text-text-muted',
    'text-gray-500': 'text-text-muted',
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    for old, new in color_map.items():
        # replace exact tailwind classes with word boundaries, except the brackets make it tricky
        # we can just use string replace
        content = content.replace(old, new)

    # Some special cases for opacity modifiers e.g. bg-[#13131a]/95
    content = content.replace('bg-panel/95', 'bg-panel/95') # actually wait, replace will do this if we run it carefully

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.jsx'):
            process_file(os.path.join(root, file))
