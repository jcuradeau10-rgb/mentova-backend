"""
Phase 3 splice script: Insert modals, add state, wrap interactive elements, add styles
"""

# Read all files
with open('/app/frontend/app/(tabs)/learn.tsx', 'r') as f:
    content = f.read()

with open('/tmp/phase3_modals.tsx', 'r') as f:
    modals_code = f.read()

with open('/app/memory/phase3_styles.tsx', 'r') as f:
    modal_styles = f.read()

lines = content.split('\n')

# ── 1. Insert modal components BEFORE ProgressView function ──
pv_line = None
for i, line in enumerate(lines):
    if 'function ProgressView(' in line:
        pv_line = i
        break

if pv_line is not None:
    # Insert modals before ProgressView (with a blank line separator)
    modal_lines = modals_code.split('\n')
    lines = lines[:pv_line] + modal_lines + ['', ''] + lines[pv_line:]
    print(f"Inserted {len(modal_lines)} modal lines before ProgressView at line {pv_line+1}")
else:
    print("ERROR: Could not find ProgressView function")
    exit(1)

# Re-join and re-split to get correct line numbers
content = '\n'.join(lines)
lines = content.split('\n')

# ── 2. Add state variables in ProgressView ──
# Find the line with "const xpAnim = useRef" and add state after it
for i, line in enumerate(lines):
    if 'const xpAnim = useRef' in line:
        # Insert after this line
        state_code = """  const [selBadge, setSelBadge] = useState<any>(null);
  const [showXpHist, setShowXpHist] = useState(false);
  const [selSkill, setSelSkill] = useState<any>(null);
  const [showLevels, setShowLevels] = useState(false);"""
        lines.insert(i + 1, state_code)
        print(f"Added modal state at line {i+2}")
        break

content = '\n'.join(lines)
lines = content.split('\n')

# ── 3. Make level circle touchable ──
# Replace the View-based level circle with TouchableOpacity
for i, line in enumerate(lines):
    if "style={[ph.levelCircle, { borderColor: hub.level_color }]}" in line and '<View' in line:
        lines[i] = line.replace('<View style={[ph.levelCircle', '<TouchableOpacity onPress={() => setShowLevels(true)} style={[ph.levelCircle')
        # Find the closing </View> for this element (next line with levelNum)
        for j in range(i+1, min(i+5, len(lines))):
            if '</View>' in lines[j] and 'levelNum' not in lines[j]:
                # This is the closing tag for levelCircle
                lines[j] = lines[j].replace('</View>', '</TouchableOpacity>')
                break
            elif 'levelNum' in lines[j]:
                # The text is inside, closing View is on next line
                for k in range(j+1, min(j+3, len(lines))):
                    if '</View>' in lines[k]:
                        lines[k] = lines[k].replace('</View>', '</TouchableOpacity>', 1)
                        print(f"Made level circle touchable at lines {i+1}-{k+1}")
                        break
                break
        break

content = '\n'.join(lines)
lines = content.split('\n')

# ── 4. Make XP bar area touchable ──
for i, line in enumerate(lines):
    if 'style={ph.xpBarWrap}' in line and '<View' in line:
        lines[i] = line.replace('<View style={ph.xpBarWrap}>', '<TouchableOpacity onPress={() => setShowXpHist(true)} activeOpacity={0.7} style={ph.xpBarWrap}>')
        # Find the closing </View> for xpBarWrap - it's a few lines down
        brace_depth = 0
        for j in range(i, len(lines)):
            brace_depth += lines[j].count('<View') + lines[j].count('<TouchableOpacity') + lines[j].count('<Animated.View')
            brace_depth -= lines[j].count('</View>') + lines[j].count('</TouchableOpacity>') + lines[j].count('/>')
            # Rough: find the line with xpHint closing and the next </View>
            if j > i and 'xpBarWrap' not in lines[j]:
                pass
        # More reliable: find the end of the xpBarWrap block
        # The pattern: <View xpBarWrap> ... </View> (about 10 lines)
        depth = 1
        for j in range(i+1, min(i+20, len(lines))):
            for ch_idx in range(len(lines[j])):
                pass
            # Count opens and closes more carefully
            opens = lines[j].count('<View') + lines[j].count('<Animated')
            closes = lines[j].count('</View>')
            # Self-closing tags
            selfclose = lines[j].count('/>')
            depth += opens
            depth -= closes
            if depth <= 0:
                lines[j] = lines[j].replace('</View>', '</TouchableOpacity>', 1)
                print(f"Made XP bar touchable at lines {i+1}-{j+1}")
                break
        break

content = '\n'.join(lines)
lines = content.split('\n')

# ── 5. Make skill items touchable ──
# Replace <View key={sk.key} with <TouchableOpacity key={sk.key} onPress
for i, line in enumerate(lines):
    if '<View key={sk.key}' in line and 'marginBottom' in line:
        lines[i] = line.replace(
            '<View key={sk.key} style={i < skills.length - 1 ? { marginBottom: 14 } : undefined}>',
            '<TouchableOpacity key={sk.key} onPress={() => setSelSkill(sk)} activeOpacity={0.7} style={i < skills.length - 1 ? { marginBottom: 14 } : undefined}>'
        )
        # Find the closing </View> for this item
        # It should be about 8 lines down
        depth = 1
        for j in range(i+1, min(i+15, len(lines))):
            depth += lines[j].count('<View')
            depth -= lines[j].count('</View>')
            if depth <= 0:
                lines[j] = lines[j].replace('</View>', '</TouchableOpacity>', 1)
                print(f"Made skill items touchable at lines {i+1}-{j+1}")
                break
        break

content = '\n'.join(lines)
lines = content.split('\n')

# ── 6. Make badge items touchable ──
# Replace <View key={b.id} style={[ph.bdgItem with <TouchableOpacity
for i, line in enumerate(lines):
    if '<View key={b.id} style={[ph.bdgItem' in line and 'testID' in line:
        lines[i] = line.replace(
            '<View key={b.id} style={[ph.bdgItem, !b.earned && { opacity: 0.35 }]}',
            '<TouchableOpacity key={b.id} onPress={() => setSelBadge(b)} activeOpacity={0.6} style={[ph.bdgItem, !b.earned && { opacity: 0.35 }]}'
        )
        # Find the closing </View> for this badge item (about 8 lines down)
        depth = 1
        for j in range(i+1, min(i+15, len(lines))):
            depth += lines[j].count('<View')
            depth -= lines[j].count('</View>')
            if depth <= 0:
                lines[j] = lines[j].replace('</View>', '</TouchableOpacity>', 1)
                print(f"Made badge items touchable at lines {i+1}-{j+1}")
                break
        break

content = '\n'.join(lines)
lines = content.split('\n')

# ── 7. Add modal renders before the height spacer ──
for i, line in enumerate(lines):
    if "style={{ height: 40 }}" in line and "progression-hub" not in line:
        # Check if this is inside the ProgressView (after skills/badges sections)
        # Find the first occurrence after the badges section
        modal_renders = """
      {/* DETAIL MODALS */}
      <BadgeDetailModal visible={!!selBadge} badge={selBadge} lang={lang} onClose={() => setSelBadge(null)} />
      <XpHistoryModal visible={showXpHist} token={token} lang={lang} onClose={() => setShowXpHist(false)} />
      <SkillDetailModal visible={!!selSkill} skill={selSkill} lang={lang} relatedMods={recentMods} onClose={() => setSelSkill(null)} />
      <LevelsRoadmapModal visible={showLevels} levels={hub.levels || []} currentLevel={hub.level} totalXp={hub.total_xp} lang={lang} onClose={() => setShowLevels(false)} />
"""
        lines.insert(i, modal_renders)
        print(f"Added modal renders at line {i+1}")
        break

# ── 8. Append modal styles at the end ──
content = '\n'.join(lines)
content = content.rstrip() + '\n\n' + modal_styles.strip() + '\n'

# Write back
with open('/app/frontend/app/(tabs)/learn.tsx', 'w') as f:
    f.write(content)

print("Done! All Phase 3 changes applied to learn.tsx")
