"""
メガミンクス：手順記号（U, R, F, L, BR, BL, DR, DL, DBR, DBL, B, D）から
上面(U)と側面上段(15位置)の状態を計算する。外部ライブラリ不要。

記法:
  X     = 面Xを外側から見て時計回りに72°
  X'    = 反時計回り72°
  X2    = 時計回り144°,  X2' = 反時計回り144°
  （全体回転 x y z は未対応。面の配置は固定）

面の配置（上から見て反時計回り）:
  上段: F, R, BR, BL, L    下段: DR, DBR, B, DBL, DL    底: D
  （F=正面, R=その右隣, B=Fの真裏, DRはFとRの下側の面）
"""
import math
import re

SQ5 = math.sqrt(5)
C = 1 / SQ5          # 隣接面の法線の内積
S = 2 / SQ5
T = 0.6              # ステッカー位置の内側への寄せ係数（任意の値でOK）

UPPER = ["F", "R", "BR", "BL", "L"]
LOWER = ["DR", "DBR", "B", "DBL", "DL"]
FACES = ["U"] + UPPER + LOWER + ["D"]


def _normals():
    n = {"U": (0, 0, 1), "D": (0, 0, -1)}
    for i, name in enumerate(UPPER):
        th = math.radians(270 + 72 * i)          # F=270°, 反時計回りに+72°ずつ
        n[name] = (S * math.cos(th), S * math.sin(th), C)
    for i, name in enumerate(LOWER):
        th = math.radians(270 + 36 + 72 * i)
        n[name] = (S * math.cos(th), S * math.sin(th), -C)
    return n


N = _normals()


def _dot(a, b): return sum(x * y for x, y in zip(a, b))
def _add(*vs): return tuple(sum(c) for c in zip(*vs))
def _mul(v, k): return tuple(x * k for x in v)


def _adjacent(a, b): return abs(_dot(N[a], N[b]) - C) < 1e-9


# ---- ステッカー生成（面ごとに 中心1 + 角5 + 辺5 = 11枚）----
stickers = []          # (face, key, pos)  key: 'c' / frozenset(面名...)
for f in FACES:
    stickers.append((f, "c", N[f]))
    for g in FACES:
        if g != f and _adjacent(f, g):
            m = _mul(_add(N[f], N[g]), 1 / (1 + C))             # 辺の中点
            stickers.append((f, frozenset([f, g]), _add(_mul(N[f], 1 - T), _mul(m, T))))
            for h in FACES:
                if h > g and h != f and _adjacent(f, h) and _adjacent(g, h):
                    v = _mul(_add(N[f], N[g], N[h]), 1 / (1 + 2 * C))   # 頂点
                    stickers.append((f, frozenset([f, g, h]), _add(_mul(N[f], 1 - T), _mul(v, T))))
assert len(stickers) == 132


def _key(p): return tuple(round(x, 6) + 0.0 for x in p)


INDEX = {_key(p): i for i, (_, _, p) in enumerate(stickers)}
LOOKUP = {(f, k): i for i, (f, k, _) in enumerate(stickers)}


def _rotate(p, axis, ang):
    k = _mul(axis, 1 / math.sqrt(_dot(axis, axis)))
    c, s = math.cos(ang), math.sin(ang)
    kxp = (k[1]*p[2]-k[2]*p[1], k[2]*p[0]-k[0]*p[2], k[0]*p[1]-k[1]*p[0])
    return _add(_mul(p, c), _mul(kxp, s), _mul(k, _dot(k, p) * (1 - c)))


def _face_move(face):
    """面faceを時計回り72°回したときの置換 perm[元の位置] = 移動先"""
    perm = list(range(len(stickers)))
    for i, (_, _, p) in enumerate(stickers):
        if _dot(p, N[face]) > 0.7:                     # 最上層に属するステッカー
            perm[i] = INDEX[_key(_rotate(p, N[face], -math.radians(72)))]
    return perm


MOVES = {f: _face_move(f) for f in FACES}
TOKEN = re.compile(r"(DBR|DBL|BR|BL|DR|DL|U|F|R|L|B|D)(2'|2|')?")


def apply(alg, state=None):
    state = list(state) if state else [s[0] for s in stickers]   # 各位置の色(=初期の面名)
    pos = 0
    alg = alg.replace("’", "'")
    for m in TOKEN.finditer(alg):
        if alg[pos:m.start()].strip():
            raise ValueError(f"解釈できない記号: {alg[pos:m.start()]!r}")
        pos = m.end()
        face, suf = m.group(1), m.group(2) or ""
        times = 1 if suf == "" else 4 if suf == "'" else 2 if suf == "2" else 3
        for _ in range(times):
            new = state[:]
            for i, j in enumerate(MOVES[face]):
                new[j] = state[i]
            state = new
    if alg[pos:].strip():
        raise ValueError(f"解釈できない記号: {alg[pos:]!r}")
    return state


def top_view(alg):
    """上面11枚＋側面上段15枚の色（面名）を返す"""
    st = apply(alg)
    at = lambda f, k: st[LOOKUP[(f, k)]]
    n = len(UPPER)
    u = {
        "center": at("U", "c"),
        "edges": [at("U", frozenset(["U", g])) for g in UPPER],                  # F,R,BR,BL,L の隣
        "corners": [at("U", frozenset(["U", UPPER[i], UPPER[(i + 1) % n]]))      # F-R, R-BR, BR-BL, BL-L, L-F
                    for i in range(n)],
    }
    sides = {}
    for i, g in enumerate(UPPER):
        prev, nxt = UPPER[(i - 1) % n], UPPER[(i + 1) % n]
        sides[g] = [at(g, frozenset(["U", g, prev])),      # 面gを外から見て左
                    at(g, frozenset(["U", g])),            # 中央（辺）
                    at(g, frozenset(["U", g, nxt]))]       # 右
    return {"U": u, "sides": sides}


def show(alg):
    r = top_view(alg)
    u = r["U"]
    print(f"手順: {alg}")
    print(f"U中心: {u['center']}")
    print("U辺 (F,R,BR,BL,L側):", " ".join(u["edges"]))
    print("U角 (F-R,R-BR,BR-BL,BL-L,L-F):", " ".join(u["corners"]))
    for g in UPPER:
        print(f"{g:>2}の上段(左→右):", " ".join(r["sides"][g]))


if __name__ == "__main__":
    import sys
    show(" ".join(sys.argv[1:]) or "R U R' U'")
