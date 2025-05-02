# TENNIS ROYALE – manual player selection version
import streamlit as st, pandas as pd, os
from datetime import datetime

st.set_page_config(page_title="Tennis Royale", layout="centered")
DATA = "tr_leaderboard.csv"
PASSWORD = "vortexmaster2025"

rating_fields = ["Serve", "Forehand", "Backhand", "Stamina", "Mental"]

default_players = ["Alcaraz", "Djokovic", "Sinner", "Swiatek", "Gauff", "Sabalenka", "Nadal", "Sakkari", "Tsitsipas"]
if "players" not in st.session_state:
    st.session_state.players = default_players.copy()

def load():
    return pd.read_csv(DATA) if os.path.exists(DATA) else pd.DataFrame(columns=["Player A","Player B","Winner","Score A","Score B","Time",*rating_fields])

def save(df): df.to_csv(DATA, index=False)

st.title("🎾 Tennis Royale")

# Add player
with st.sidebar.expander("➕ Add Player"):
    new = st.text_input("New player name")
    if st.button("Add") and new:
        st.session_state.players.append(new)
        st.success(f"{new} added!")

# Select battle
col1, col2 = st.columns(2)
p1 = col1.selectbox("🔵 Select Player A", st.session_state.players, key="playerA")
p2 = col2.selectbox("🟣 Select Player B", st.session_state.players, key="playerB")

if p1 == p2:
    st.warning("Pick two different players!")
    st.stop()

st.subheader(f"{p1} vs {p2}")

ratingsA, ratingsB = {}, {}
for field in rating_fields:
    c1, c2 = st.columns(2)
    ratingsA[field] = c1.slider(f"{field} – {p1}", 1, 10, 5)
    ratingsB[field] = c2.slider(f"{field} – {p2}", 1, 10, 5)

if st.button("Submit Battle"):
    scoreA, scoreB = sum(ratingsA.values()), sum(ratingsB.values())
    winner = p1 if scoreA > scoreB else p2 if scoreB > scoreA else "Tie"
    row = {"Player A": p1, "Player B": p2, "Winner": winner,
           "Score A": scoreA, "Score B": scoreB, "Time": datetime.now().strftime("%Y-%m-%d %H:%M")}
    row.update(ratingsA if scoreA >= scoreB else ratingsB)
    df = pd.concat([load(), pd.DataFrame([row])], ignore_index=True)
    save(df)
    st.success(f"Winner: {winner}!")

st.markdown("---")
st.subheader("🏆 Leaderboard")
df = load()
st.dataframe(df.tail(20).iloc[::-1], use_container_width=True)

with st.expander("🔥 Reset"):
    pw = st.text_input("Password", type="password")
    if st.button("Reset All") and pw == PASSWORD:
        os.remove(DATA) if os.path.exists(DATA) else None
        st.warning("Leaderboard wiped!")
        st.experimental_rerun()
