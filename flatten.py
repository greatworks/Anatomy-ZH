#!/usr/bin/env python3
"""anatomy-zh 扁平化：examples/<名>/ → examples-<名>/，kit/react/ → kit-react/
并重算三类引用：import 相对路径、join(HERE,..) 运行时路径、文档路径。"""
import os, re, shutil, sys

ROOT = r'D:/WSWorkbuddy/SkillTools/outputs/anatomy-zh/anatomy-zh'

EXAMPLE_DIRS = ['arcade-cabinet', 'desk-computer', 'dial-indicator', 'raptor-engine',
                'ripple-tank', 'spot-plate', 'test-rig', 'turning-dial']

# ---------- 1. 移动目录 ----------
moved = []
for name in EXAMPLE_DIRS:
    src = os.path.join(ROOT, 'examples', name)
    dst = os.path.join(ROOT, f'examples-{name}')
    if os.path.isdir(src):
        shutil.move(src, dst)
        moved.append(f'examples/{name} -> examples-{name}')
src = os.path.join(ROOT, 'kit', 'react')
dst = os.path.join(ROOT, 'kit-react')
if os.path.isdir(src):
    shutil.move(src, dst)
    moved.append('kit/react -> kit-react')
# examples/ 现在应为空，删除
empty_ex = os.path.join(ROOT, 'examples')
if os.path.isdir(empty_ex) and not os.listdir(empty_ex):
    os.rmdir(empty_ex)

# ---------- 2. 代码引用重写 ----------
def rewrite_code(path, rel):
    text = open(path, encoding='utf-8').read()
    orig = text
    if rel.startswith('examples-'):
        text = text.replace('"../../kit/react/', '"../kit-react/')
        text = text.replace('"../../kit/', '"../kit/')
        text = text.replace('"../../scripts/', '"../scripts/')
        # arcade-cabinet 的 join(HERE, "..", "..", "kit", ...)
        text = text.replace('join(HERE, "..", "..", "kit"', 'join(HERE, "..", "kit"')
        text = text.replace("join(HERE, '..', '..', 'kit'", "join(HERE, '..', 'kit'")
    if rel == 'kit-react/draw.tsx':
        text = text.replace('from "../iso-kit"', 'from "../kit/iso-kit"')
    if rel == 'scripts/publish.mjs':
        # examples/ 已扁平化为 examples-<名>/：放行 figure 位于 examples-* 内的情况
        text = text.replace(
            'if (inside(SKILL, source) && !inside(join(SKILL, "examples"), source))',
            'if (inside(SKILL, source) && !/(^|\\/)examples-/.test(posix(source)))')
    if text != orig:
        open(path, 'w', encoding='utf-8', newline='\n').write(text)
        return True
    return False

# ---------- 3. 文档引用重写 ----------
def rewrite_doc(path, rel):
    text = open(path, encoding='utf-8').read()
    orig = text
    for name in EXAMPLE_DIRS:
        text = text.replace(f'examples/{name}/', f'examples-{name}/')
    text = text.replace('kit/react/', 'kit-react/')
    # 泛指表述适配
    text = text.replace('kit/、scripts/、examples/ 下的代码与资源保持原样',
                        'kit/、kit-react/、scripts/、examples-*/ 下的代码与资源保持原样')
    if text != orig:
        open(path, 'w', encoding='utf-8', newline='\n').write(text)
        return True
    return False

changed = []
for dirpath, dirs, files in os.walk(ROOT):
    for f in files:
        p = os.path.join(dirpath, f)
        rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
        if f.endswith(('.mjs', '.ts', '.tsx', '.js')):
            if rewrite_code(p, rel):
                changed.append('code: ' + rel)
        elif f.endswith('.md'):
            if rewrite_doc(p, rel):
                changed.append('doc:  ' + rel)

print('=== 移动 ===')
for m in moved: print(' ', m)
print('=== 改写文件 ===')
for c in changed: print(' ', c)

# ---------- 4. 自检 ----------
print('=== 自检 ===')
bad_dirs = []
for dirpath, dirs, files in os.walk(ROOT):
    depth = os.path.relpath(dirpath, ROOT).count(os.sep)
    if depth >= 2:
        bad_dirs.append(os.path.relpath(dirpath, ROOT))
print('三层目录:', bad_dirs or '无 ✅')

# 残留引用扫描
residue = []
for dirpath, dirs, files in os.walk(ROOT):
    for f in files:
        if not f.endswith(('.mjs', '.ts', '.tsx', '.js', '.md')): continue
        p = os.path.join(dirpath, f)
        rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
        for i, line in enumerate(open(p, encoding='utf-8'), 1):
            if rel.startswith('examples-') or rel == 'kit-react/draw.tsx':
                if '../../kit' in line or '../../scripts' in line:
                    residue.append(f'{rel}:{i} 残留 ../../ 引用')
            if 'kit/react/' in line and 'kit-react' not in line:
                residue.append(f'{rel}:{i} 残留 kit/react/')
            if re.search(r'examples/[a-z]', line) and 'examples-' not in line and 'examples/evals' not in line:
                residue.append(f'{rel}:{i} 残留 examples/<名>/')
print('残留引用:', residue or '无 ✅')
