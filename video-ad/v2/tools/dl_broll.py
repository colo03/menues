import urllib.request, os, sys, concurrent.futures as cf

V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(V2, "broll")
IDS = {
    "phone_bar_321": 321, "phone_hands_4915": 4915, "phone_woman_43270": 43270,
    "terrace_man_99905": 99905, "terrace_cafe_99897": 99897, "friends_cafe_43248": 43248,
    "resto_customers_4385": 4385, "bar_beer_tap_8709": 8709, "bar_beer_tap_8710": 8710,
    "bar_cocktail_4295": 4295, "bar_shaker_5132": 5132, "bar_busy_4043": 4043,
    "bar_pour_43968": 43968, "bar_serve_43962": 43962, "waiter_drinks_43984": 43984,
    "kitchen_chef_39535": 39535, "kitchen_chefs_15875": 15875, "kitchen_wok_47555": 47555,
    "kitchen_plating_13261": 13261, "kitchen_grill_4678": 4678, "waiter_pizza_44008": 44008,
    "waiter_pizza_44003": 44003, "waiter_stew_4672": 4672, "waiter_order_24405": 24405,
    "waiter_gourmet_2430": 2430, "waiter_outdoor_12932": 12932, "waiter_help_22314": 22314,
    "outdoor_seating_2597": 2597, "bar_atmos_8711": 8711, "pizza_slice_42487": 42487,
}
extra = sys.argv[1:]
if extra:
    IDS = {a.split("=")[0]: int(a.split("=")[1]) for a in extra}

def dl(item):
    name, i = item
    path = os.path.join(OUT, name + ".mp4")
    for res in ("1080", "720"):
        url = f"https://assets.mixkit.co/videos/{i}/{i}-{res}.mp4"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            return f"{name} {res} OK {os.path.getsize(path)}"
        except Exception as e:
            last = f"{name} {res} ERR {e}"
    return last

os.makedirs(OUT, exist_ok=True)
with cf.ThreadPoolExecutor(10) as ex:
    for r in ex.map(dl, IDS.items()):
        print(r, flush=True)
