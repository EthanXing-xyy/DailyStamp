"""The word library's plan: every mood word, the pharmacy cabinet it sits in, and (for the words added in bulk) the
emblem codex is to draw. Fixing the motif here, as terms.py does for the solar terms, keeps the emblems from repeating
(codex left to itself drew two sloths, two flamingos and three alarm clocks) and keeps each one a visual pun.

`python dailystamp.py words` draws the missing ones one at a time (parallel codex runs swap their images), then writes
their leaflets. Nothing here runs in the app: the browser only reads the results."""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

# the pharmacy's cabinets, in tab order: (key, name, english)
GROUPS = [("work", "打工", "WORK"), ("mood", "心情", "MOOD"), ("social", "社交", "SOCIAL"), ("meme", "网梗", "MEMES")]

# (phrase, english, group, motif); the first 24 were drawn before this list existed (motif None: only filed)
WORDS = [
    *[(p, "", "work", None) for p in ("周一", "周末", "咖啡因", "摆烂", "躺平", "内耗")],
    *[(p, "", "mood", None) for p in ("暴躁", "犯困", "松弛", "无语", "委屈", "开心", "失眠", "想家", "焦虑", "清醒", "惊吓", "emo")],
    *[(p, "", "social", None) for p in ("社恐", "心动", "鸽了")],
    *[(p, "", "meme", None) for p in ("破防", "上头", "发疯")],

    ("牛马", "workhorse", "work", "a weary ox with an office ID badge on a lanyard hanging round its neck"),
    ("班味", "office funk", "work", "a limp, droopy necktie giving off three wavy stink lines"),
    ("摸鱼", "slacking off", "work", "a fishing rod hooking a fish up out of a computer monitor screen"),
    ("加班", "overtime", "work", "a desk lamp shining on a tall, teetering stack of paper files"),
    ("熬夜", "up all night", "work", "a soup pot simmering with bubbles and steam under a small crescent moon"),
    ("画饼", "pie in the sky", "work", "a big round pie painted on a canvas standing on an artist's easel, a paintbrush beside it"),
    ("精神离职", "quiet quitting", "work", "an empty business suit sitting upright in an office swivel chair, with nobody inside it"),
    ("下班", "clocking off", "work", "a punched time card folded into a paper airplane, flying away with speed lines"),
    ("内卷", "rat race", "work", "a tightly rolled Swiss roll cake seen from the end, its spiral wound very tight"),
    ("上岸", "made it ashore", "work", "a life buoy ring lying on a small sandy shore beside a little palm tree"),
    ("暴富", "overnight rich", "work", "a bulging money sack bursting open with gold coins spilling out"),
    ("干饭", "chow time", "work", "a huge heaped bowl of steaming rice with a pair of chopsticks lying across the rim (not stuck upright)"),
    ("背锅", "scapegoat", "work", "a snail whose shell is a big black iron wok with a handle"),
    ("甲方", "the client", "work", "a clipboard wearing a small gold king's crown"),
    ("咸鱼", "salted fish", "work", "a flat salted dried fish hung up on a washing line by a wooden clothes peg"),
    ("月光", "paycheck gone", "work", "an empty wallet held upside down, a single little moth fluttering out of it"),
    ("副业", "side hustle", "work", "a tiny street food cart with a scalloped striped awning"),
    ("打卡", "clock in", "work", "a big fingertip pressed on a fingerprint scanner pad, a tick mark glowing beside it"),

    ("麻了", "numb", "mood", "a sprig of Sichuan peppercorns with zigzag tingling sparks around it"),
    ("红温", "seething", "mood", "a kettle boiling over, whistling out jets of steam"),
    ("心累", "heart-weary", "mood", "a half-deflated heart-shaped balloon drooping on its string"),
    ("佛系", "zen", "mood", "a lotus flower floating on calm, round water ripples"),
    ("小确幸", "small joys", "mood", "a cupcake with a single cherry on top"),
    ("多巴胺", "dopamine", "mood", "a gumball machine packed with round candy balls"),
    ("情绪稳定", "unbothered", "mood", "a calm capybara soaking in a round hot-spring tub with a mandarin orange balanced on its head"),
    ("汗流浃背", "sweating bullets", "mood", "an ice-cream cone melting fast, flinging big drops of sweat"),
    ("治愈", "healing", "mood", "a cat curled into a round loaf, asleep on a plump cushion in a patch of sun"),
    ("放空", "zoning out", "mood", "a glass jar with a lid, holding nothing but a single small fluffy cloud"),
    ("迷茫", "lost", "mood", "a pocket compass whose needle is spinning round in a blur"),
    ("期待", "can't wait", "mood", "a gift box with a big ribbon bow, its lid just lifting open"),

    ("社牛", "social bull", "social", "a bull in a party hat belting into a karaoke microphone"),
    ("搭子", "buddy", "social", "two matching sneakers side by side with their laces tied together"),
    ("i人", "introvert", "social", "a blanket rolled up tight like a burrito, with only two bare feet sticking out of one end"),
    ("e人", "extrovert", "social", "a party blower horn unrolling and blasting out a burst of confetti"),
    ("嘴替", "mouthpiece", "social", "a megaphone whose bell has a big pair of pouting lips on it"),
    ("恋爱脑", "love-brained", "social", "a brain built entirely out of little stacked hearts"),
    ("柠檬精", "green with envy", "social", "a whole lemon that clearly reads as a lemon (a plump oval with a pointed nub at each end, dimpled peel, one leaf on its stem), squeezed hard so it squirts sour drops"),
    ("显眼包", "show-off", "social", "a cardboard parcel box wearing sunglasses, standing in a spotlight beam"),
    ("已读不回", "left on read", "social", "a chat speech bubble with two small tick marks in its corner and a cobweb spun across it"),
    ("秒回", "instant reply", "social", "a chat speech bubble flying fast on a pair of lightning-bolt wings"),
    ("社死", "social death", "social", "an ostrich with its head buried deep in a mound of sand"),
    ("吃瓜", "watching the drama", "social", "a slice of watermelon with a pair of theatre opera glasses resting on it"),
    ("拉黑", "blocked", "social", "a paint roller rolling a thick black stripe over a round smiley-face sticker"),
    ("点赞", "like", "social", "a lollipop on a stick, its candy shaped like a thumbs-up hand"),
    ("海王", "player", "social", "a trident whose three prongs each have a little heart hooked on them"),
    ("磕到了", "shipping it", "social", "two horseshoe magnets snapping together with little sparks between them"),
    ("边界感", "boundaries", "social", "a small white picket fence standing in a ring round a single potted cactus"),
    ("塑料友情", "plastic friends", "social", "two cheap plastic toy rings with big fake gems, one of them cracked"),
    ("双向奔赴", "meet halfway", "social", "two folded paper airplanes, each drawn with bold outlines and fold creases, flying toward each other from left and right, almost nose to nose, with little dashed flight trails behind them, on a plain white background"),
    ("人情世故", "social graces", "social", "a red gift envelope tucked in among the fruit of a gift fruit basket"),
    ("破冰", "icebreaker", "social", "an ice cube cracking open with a curly party streamer popping out of the crack"),

    ("电子榨菜", "screen pickles", "meme", "a bowl of rice with a smartphone lying on top of it like a side dish"),
    ("特种兵", "speedrun tourist", "meme", "a sneaker blasting off on rocket flames, a folded map tucked under its laces"),
    ("硬控", "hard-locked", "meme", "a marionette's wooden control cross with its strings dangling down"),
    ("抽象", "abstract", "meme", "a perfectly cube-shaped egg sitting in an egg cup"),
    ("小趴菜", "small fry", "meme", "a small bok choy lying flat on its back, its leaves splayed out"),
    ("脆皮", "fragile", "meme", "a crispy fried spring roll wrapped in a bandage with a sticking plaster"),
    ("蚌埠住了", "can't hold it", "meme", "a clam bursting open so hard that its pearl shoots out"),
    ("泰酷辣", "so cool", "meme", "a chili pepper wearing sunglasses"),
    ("尊嘟假嘟", "for real?", "meme", "a small duck pouting its bill, one eyebrow raised in doubt"),
    ("真香", "so good after all", "meme", "a roast chicken drumstick with wavy lines of delicious smell rising from it"),
    ("电子木鱼", "cyber merit", "meme", "a Chinese wooden fish temple block (muyu): a round, slightly flattened hollow wooden drum carved with fish scales and a wide slit mouth, resting on a small cushion, a thin wooden mallet leaning against it, one sparkle above"),
    ("回旋镖", "boomerang", "meme", "a boomerang with curved motion lines showing it swinging back"),
    ("yyds", "GOAT", "meme", "a golden two-handled trophy cup with a glowing halo floating above it"),
    ("绝绝子", "simply the best", "meme", "a brass fanfare trumpet blasting out a spray of star bursts"),
    ("芭比Q了", "it's toast", "meme", "a round kettle barbecue grill with one sausage on it going up in flames"),
    ("躺赢", "win lying down", "meme", "an inflatable pool float shaped like a trophy cup, bobbing on a ripple"),
    ("鼠鼠", "little me", "meme", "a tiny mouse peeking out of a round hole in a wedge of cheese"),
    ("退退退", "back off", "meme", "a boxing glove on the end of a coiled spring, punching outward"),
    ("包的", "guaranteed", "meme", "a steamed bun (baozi, pleated on top) wearing a gold medal on a ribbon"),
    ("老六", "sneaky player", "meme", "a round leafy bush with two wide eyes peeking out of it"),
    ("下头", "turn-off", "meme", "a firework rocket fizzling out, a droopy wisp of smoke curling down from it"),
]

_GROUP_OF = {p: g for p, _, g, _ in WORDS}


def group_of(phrase: str) -> str:
    return _GROUP_OF.get(phrase.strip(), "mood")


def generate_missing(phrases: list[str] | None = None, redo: bool = False) -> None:
    """Draw the emblem of every planned word that has none (or just the given ones; redo draws them again), one at a
    time, then write the leaflets that are missing."""
    import os
    from . import leaflet, library
    todo = [w for w in WORDS if w[3] and (not phrases or w[0] in phrases)]
    if not redo:
        todo = [w for w in todo if not os.path.exists(library._entry_path(library.make_id(w[0])))]
    print(f"{len(todo)} emblem(s) to draw")
    for p, en, _, motif in todo:
        t0 = time.time()
        if redo:
            library.forget(p)
        e = library.generate(p, en, idea=motif)
        print(f"  {p}: {e.get('status')}  {e.get('concept', '')}  ({time.time() - t0:.0f}s)", flush=True)

    words = [w for w in WORDS if not phrases or w[0] in phrases]
    lt = [(p, en) for p, en, *_ in words if os.path.exists(library._entry_path(library.make_id(p))) and not leaflet.load(p)]
    print(f"{len(lt)} leaflet(s) to write")

    def one(w):
        t0 = time.time()
        d = leaflet.generate(*w)
        print(f"  {w[0]}: {d.get('status')}  {d.get('name', '')}  ({time.time() - t0:.0f}s)", flush=True)
    with ThreadPoolExecutor(max_workers=3) as ex:
        list(ex.map(one, lt))
