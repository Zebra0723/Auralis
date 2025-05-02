# TENNIS ROYALE – compare two pros head-to-head
import streamlit as st, pandas as pd, random, os
from datetime import datetime

st.set_page_config(page_title="Tennis Royale", layout="centered")
DATA = "tr_leaderboard.csv"
PASSWORD = "vortexmaster2025"

rating_fields = ["Serve", "Forehand", "Backhand", "Stamina", "Mental"]

default_players = [
    {"name":"Carlos Alcaraz"}, {"name":"Novak Djokovic"}, {"name":"Jannik Sinner"},
    {"name":"Iga Swiatek"}, {"name":"Coco Gauff"}, {"name":"Aryna Sabalenka"},
    {"name":"Rafael Nadal"}, {"name":"Maria Sakkari"}, {"name":"Stefanos Tsitsipas"}
]

ss = st.session_state
if "players" not in ss: ss.players = default_players.copy()
if "duel"    not in ss: ss.duel    = random.sample(ss.players,2)
if "history" not in ss: ss.history = []

def pick_two(): ss.duel = random.sample(ss.players,2)

def load(): return pd.read_csv(DATA) if os.path.exists(DATA) \
                    else pd.DataFrame(columns=["Player A","Player B","Winner",
                                                "Score A","Score B","Time",*rating_fields])

def save(df): df.to_csv(DATA,index=False)

st.title("🎾 Tennis Royale")

# Add player
with st.sidebar.expander("➕ Add Player"):
    name = st.text_input("Name")
    if st.button("Add") and name:
        ss.players.append({"name":name}); st.success(f"{name} added!")

# Current duel
pA,pB = ss.duel
st.subheader(f"🔵 {pA['name']}  vs  🟣 {pB['name']}")

ratingsA,ratingsB={},{}
for f in rating_fields:
    c1,c2 = st.columns(2)
    ratingsA[f] = c1.slider(f"{f} – {pA['name']}",1,10,5)
    ratingsB[f] = c2.slider(f"{f} – {pB['name']}",1,10,5)

if st.button("Submit"):
    sA,sB = sum(ratingsA.values()), sum(ratingsB.values())
    winner = pA['name'] if sA>sB else pB['name'] if sB>sA else "Tie"
    row = {"Player A":pA['name'],"Player B":pB['name'],"Winner":winner,
           "Score A":sA,"Score B":sB,"Time":datetime.now().strftime("%Y-%m-%d %H:%M"),
           **({f:ratingsA[f] if sA>=sB else ratingsB[f] for f in rating_fields})}
    df = pd.concat([load(), pd.DataFrame([row])], ignore_index=True)
    save(df); ss.history.append(f"{pA['name']} vs {pB['name']} – Winner {winner} ({sA}-{sB})")
    st.success(f"Recorded! Winner: {winner}"); pick_two(); st.experimental_rerun()

# Leaderboard
st.markdown("---"); st.subheader("🏆 Leaderboard (latest 25)")
df = load()
st.dataframe(df.tail(25).iloc[::-1], use_container_width=True)

with st.expander("📜 History"):  [st.write(x) for x in ss.history[::-1]]

# Reset
with st.expander("🔥 Reset"):
    if st.text_input("Password",type="password")==PASSWORD and st.button("Wipe"):
        if os.path.exists(DATA): os.remove(DATA); ss.history.clear(); st.warning("Reset!")
        st.experimental_rerun()
