# Покадровая маска бутылки: для каждой строки кадра ищем левый и правый край бутылки.
import subprocess, json, sys
name, src = sys.argv[1], sys.argv[2]
W, H = 600, 1080
T = 246                                   # всё темнее этого — бутылка (фон 249–255)
ext = json.load(open('ext.json'))         # общий контур по всем кадрам (масштаб 300x540)
C = 149.5
hw = {}
for y, a, b in ext:
    if a is None or y < 27 or y > 496: continue
    hw[y] = max(C - a, b - C)
for y in range(27, 34): hw[y] = max(hw.get(y, 0), 26.5)
for y in range(27, 497):
    if y not in hw: hw[y] = hw.get(y - 1, 26.5)
sm = {}
for y in sorted(hw):
    w = sorted(hw.get(k, hw[y]) for k in range(y - 3, y + 4)); sm[y] = w[len(w) // 2]
base = [(497, 71.5), (503, 71.3), (510, 70.5), (516, 66.5), (520, 59.0), (523, 48.0), (525, 30.0)]
def basehw(y):
    if y < base[0][0]: return base[0][1]
    for (y0, h0), (y1, h1) in zip(base, base[1:]):
        if y0 <= y <= y1: return h0 + (h1 - h0) * (y - y0) / (y1 - y0)
    return None
S = [None] * H                             # статичная полуширина для каждой строки (px кадра 1080)
for Y in range(H):
    y = Y / 2.0
    if 27 <= y <= 496:
        y0 = int(y); y1 = min(496, y0 + 1); t = y - y0
        S[Y] = 2 * (sm[y0] * (1 - t) + sm[y1] * t)
    elif 496 < y <= 525:
        S[Y] = 2 * basehw(y)
TOP, NECK, BODY, FEET = 54, 118, 962, 963   # ниже BODY — донышко: край ищем по самому резкому перепаду яркости   # до NECK — крышка (общий контур), с FEET — донышко ищем по более тёмному порогу
tbl = bytes(1 if v < T else 0 for v in range(256))
ramp = bytes(255 if v <= 228 else (0 if v >= 240 else int(255 * (240 - v) / 12)) for v in range(256))   # светлый пол уходит
FADE = 9
ramps = [bytes(int(ramp[v] * (k + 1) / (FADE + 1)) for v in range(256)) for k in range(FADE + 1)]
for Y in range(1051, 1080): S[Y] = S[1040]
one = b'\x01'
Z = bytes(W); O = b'\xff' * W
dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-vf', 'crop=600:1080:660:0,format=gray', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', '%dx%d' % (W, H), '-r', '24', '-i', '-', '-c:v', 'ffv1', 'matte_%s.mkv' % name], stdin=subprocess.PIPE)
n = 0; stats = []
while True:
    buf = dec.stdout.read(W * H)
    if len(buf) < W * H: break
    L = [None] * H; R = [None] * H
    for Y in range(NECK, BODY + 1):
        s = S[Y]; lo = max(0, int(300 - s - 16)); hi = min(W, int(300 + s + 16))
        row = buf[Y * W + lo: Y * W + hi].translate(tbl)
        a = row.find(one)
        if a < 0: continue
        b = row.rfind(one)
        if abs((b - a + 1) - 2 * s) <= 18: L[Y] = lo + a; R[Y] = lo + b
    cs = sorted((L[Y] + R[Y]) / 2.0 for Y in range(600, 961) if L[Y] is not None)
    cx = cs[len(cs) // 2] if cs else 299.5
    for Y in range(NECK, BODY + 1):
        if L[Y] is None: L[Y] = cx - (S[Y] - 3); R[Y] = cx + (S[Y] - 3)
    # сглаживание по строкам (медиана по 7)
    Ls = L[:]; Rs = R[:]
    for Y in range(NECK + 3, BODY - 2):
        w = sorted(L[Y - 3:Y + 4]); Ls[Y] = w[3]
        w = sorted(R[Y - 3:Y + 4]); Rs[Y] = w[3]
    # донышко: левый край — самый резкий перепад яркости рядом с ожидаемым местом, правый — зеркально
    BL = {}; prev = None; miss = 0
    for Y in range(BODY + 1, 1079):
        row = buf[Y * W:(Y + 1) * W]; c = int(cx)
        if min(row[c - 30:c + 30]) > 205:
            miss += 1
            if miss >= 3: break
            continue
        miss = 0
        x0 = max(2, int(cx - S[Y] - 10)); x1 = min(c - 12, int(cx - S[Y] + 46)); best = 0; bx = None
        for x in range(x0, x1):
            g = row[x] - row[x + 4]
            if g > best: best = g; bx = x
        if bx is not None and best >= 9: prev = bx + 2
        if prev is not None: BL[Y] = prev
    ys = sorted(BL)
    for Y in ys:                                       # сглаживание по строкам
        w = sorted(BL[k] for k in range(Y - 3, Y + 4) if k in BL); BL[Y] = w[len(w) // 2]
    yend = max(ys) if ys else 0
    out = []
    for Y in range(H):
        s = S[Y]
        if s is None: out.append(Z); continue
        if Y > BODY:                                  # донышко
            a = BL.get(Y)
            if a is None: out.append(Z); continue
            a = max(0, a); b = min(W - 1, int(round(2 * cx - a)))
            k = min(FADE, yend - Y)                      # самый низ мягко сходит на нет
            out.append(Z[:a] + buf[Y * W + a: Y * W + b + 1].translate(ramps[k]) + Z[:W - 1 - b]); continue
        if NECK <= Y <= BODY: a, b = Ls[Y], Rs[Y]
        else: a, b = cx - (s - 4), cx + (s - 4)
        a = max(0, int(round(a))); b = min(W - 1, int(round(b)))
        out.append(Z[:a] + O[:b - a + 1] + Z[:W - 1 - b])
    enc.stdin.write(b''.join(out)); n += 1
    stats.append((round(cx, 1), Ls[400], Rs[400], Ls[800], Rs[800]))
enc.stdin.close(); enc.wait(); dec.wait()
print(name, 'frames', n, 'first', stats[0], 'mid', stats[len(stats) // 2], 'cx range', min(s[0] for s in stats), max(s[0] for s in stats))
