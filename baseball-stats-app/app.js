const STORAGE_KEY = "baseball-stat-keeper-v2";
const INNINGS = 9;

const state = loadState();

const els = {
  awayScore: document.getElementById("away-score"),
  homeScore: document.getElementById("home-score"),
  inningValue: document.getElementById("inning-value"),
  playerForm: document.getElementById("player-form"),
  playerName: document.getElementById("player-name"),
  playerList: document.getElementById("player-list"),
  eventForm: document.getElementById("event-form"),
  eventPlayer: document.getElementById("event-player"),
  eventResult: document.getElementById("event-result"),
  statsBody: document.getElementById("stats-body"),
  scorebookTable: document.getElementById("scorebook-table"),
  resetBtn: document.getElementById("reset-btn"),
};

document.addEventListener("click", onClickControl);
document.addEventListener("input", onScorebookInput);
els.playerForm.addEventListener("submit", onAddPlayer);
els.eventForm.addEventListener("submit", onRecordEvent);
els.resetBtn.addEventListener("click", onReset);

render();

function onClickControl(e) {
  const action = e.target?.dataset?.action;
  if (!action) return;

  switch (action) {
    case "away-inc":
      state.game.away += 1;
      break;
    case "away-dec":
      state.game.away = Math.max(0, state.game.away - 1);
      break;
    case "home-inc":
      state.game.home += 1;
      break;
    case "home-dec":
      state.game.home = Math.max(0, state.game.home - 1);
      break;
    case "inning-inc":
      state.game.inning += 1;
      break;
    case "inning-dec":
      state.game.inning = Math.max(1, state.game.inning - 1);
      break;
    default:
      return;
  }

  persist();
  renderScore();
}

function onAddPlayer(e) {
  e.preventDefault();
  const name = els.playerName.value.trim();
  if (!name) return;

  const id = crypto.randomUUID();
  state.players.push({ id, name, stats: emptyStats() });
  state.scorebook[id] = emptyScoreRow();

  els.playerName.value = "";
  persist();
  render();
}

function onRecordEvent(e) {
  e.preventDefault();
  const playerId = els.eventPlayer.value;
  const result = els.eventResult.value;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  applyResult(player.stats, result);
  persist();
  renderStats();
}

function onScorebookInput(e) {
  const playerId = e.target?.dataset?.playerId;
  const cellType = e.target?.dataset?.cellType;
  if (!playerId || !cellType) return;

  if (!state.scorebook[playerId]) {
    state.scorebook[playerId] = emptyScoreRow();
  }

  if (cellType === "inning") {
    const inningIndex = Number(e.target.dataset.inningIndex);
    state.scorebook[playerId].innings[inningIndex] = e.target.value.slice(0, 3).toUpperCase();
  }

  if (cellType === "total") {
    const totalKey = e.target.dataset.totalKey;
    state.scorebook[playerId].totals[totalKey] = e.target.value.slice(0, 2);
  }

  persist();
}

function onReset() {
  const ok = window.confirm("Reset the entire game and all player stats?");
  if (!ok) return;

  state.game = { away: 0, home: 0, inning: 1 };
  state.players = [];
  state.scorebook = {};

  persist();
  render();
}

function applyResult(stats, result) {
  stats.PA += 1;

  switch (result) {
    case "1B":
      stats.AB += 1;
      stats.H += 1;
      stats.TB += 1;
      break;
    case "2B":
      stats.AB += 1;
      stats.H += 1;
      stats.TB += 2;
      break;
    case "3B":
      stats.AB += 1;
      stats.H += 1;
      stats.TB += 3;
      break;
    case "HR":
      stats.AB += 1;
      stats.H += 1;
      stats.TB += 4;
      break;
    case "BB":
      stats.BB += 1;
      break;
    case "K":
    case "OUT":
      stats.AB += 1;
      break;
    case "SF":
      stats.SF += 1;
      break;
    default:
      break;
  }
}

function render() {
  renderScore();
  renderRoster();
  renderPlayerSelect();
  renderScorebook();
  renderStats();
}

function renderScore() {
  els.awayScore.textContent = String(state.game.away);
  els.homeScore.textContent = String(state.game.home);
  els.inningValue.textContent = String(state.game.inning);
}

function renderRoster() {
  els.playerList.innerHTML = "";

  for (const player of state.players) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${escapeHtml(player.name)}</span>
      <button type="button">Remove</button>
    `;

    li.querySelector("button")?.addEventListener("click", () => {
      state.players = state.players.filter((p) => p.id !== player.id);
      delete state.scorebook[player.id];
      persist();
      render();
    });

    els.playerList.appendChild(li);
  }
}

function renderPlayerSelect() {
  els.eventPlayer.innerHTML = "";

  if (!state.players.length) {
    const option = document.createElement("option");
    option.textContent = "Add a player first";
    option.value = "";
    els.eventPlayer.appendChild(option);
    els.eventPlayer.disabled = true;
    return;
  }

  els.eventPlayer.disabled = false;

  for (const player of state.players) {
    const option = document.createElement("option");
    option.value = player.id;
    option.textContent = player.name;
    els.eventPlayer.appendChild(option);
  }
}

function renderScorebook() {
  const inningsHeader = Array.from({ length: INNINGS }, (_, i) => `<th>${i + 1}</th>`).join("");

  const rows = state.players
    .map((player, idx) => {
      if (!state.scorebook[player.id]) {
        state.scorebook[player.id] = emptyScoreRow();
      }

      const row = state.scorebook[player.id];
      const inningCells = row.innings
        .map(
          (value, inningIndex) => `
            <td>
              <input
                class="inning-cell"
                value="${escapeHtml(value)}"
                data-player-id="${player.id}"
                data-cell-type="inning"
                data-inning-index="${inningIndex}"
              />
            </td>
          `,
        )
        .join("");

      return `
        <tr>
          <td>${idx + 1}. ${escapeHtml(player.name)}</td>
          ${inningCells}
          <td><input class="total-cell" value="${escapeHtml(row.totals.AB)}" data-player-id="${player.id}" data-cell-type="total" data-total-key="AB" /></td>
          <td><input class="total-cell" value="${escapeHtml(row.totals.R)}" data-player-id="${player.id}" data-cell-type="total" data-total-key="R" /></td>
          <td><input class="total-cell" value="${escapeHtml(row.totals.H)}" data-player-id="${player.id}" data-cell-type="total" data-total-key="H" /></td>
          <td><input class="total-cell" value="${escapeHtml(row.totals.RBI)}" data-player-id="${player.id}" data-cell-type="total" data-total-key="RBI" /></td>
        </tr>
      `;
    })
    .join("");

  els.scorebookTable.innerHTML = `
    <thead>
      <tr>
        <th>Lineup</th>
        ${inningsHeader}
        <th>AB</th>
        <th>R</th>
        <th>H</th>
        <th>RBI</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="14">Add players to start scoring.</td></tr>'}
    </tbody>
  `;
}

function renderStats() {
  els.statsBody.innerHTML = "";

  for (const player of state.players) {
    const s = player.stats;
    const avg = ratio(s.H, s.AB);
    const obp = ratio(s.H + s.BB, s.AB + s.BB + s.SF);
    const slg = ratio(s.TB, s.AB);
    const ops = avgNumber(Number(obp) + Number(slg));

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(player.name)}</td>
      <td>${s.PA}</td>
      <td>${s.AB}</td>
      <td>${s.H}</td>
      <td>${s.BB}</td>
      <td>${s.TB}</td>
      <td>${avg}</td>
      <td>${obp}</td>
      <td>${slg}</td>
      <td>${ops}</td>
    `;

    els.statsBody.appendChild(tr);
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialState();

  try {
    const parsed = JSON.parse(raw);
    return {
      game: {
        away: Number(parsed?.game?.away ?? 0),
        home: Number(parsed?.game?.home ?? 0),
        inning: Math.max(1, Number(parsed?.game?.inning ?? 1)),
      },
      players: Array.isArray(parsed?.players)
        ? parsed.players.map((p) => ({
            id: String(p.id),
            name: String(p.name),
            stats: {
              ...emptyStats(),
              ...(p.stats || {}),
            },
          }))
        : [],
      scorebook: sanitizeScorebook(parsed?.scorebook),
    };
  } catch {
    return initialState();
  }
}

function sanitizeScorebook(value) {
  if (!value || typeof value !== "object") return {};

  const safe = {};
  for (const [playerId, row] of Object.entries(value)) {
    safe[playerId] = {
      innings: Array.isArray(row?.innings)
        ? row.innings.slice(0, INNINGS).map((v) => String(v ?? ""))
        : Array.from({ length: INNINGS }, () => ""),
      totals: {
        AB: String(row?.totals?.AB ?? ""),
        R: String(row?.totals?.R ?? ""),
        H: String(row?.totals?.H ?? ""),
        RBI: String(row?.totals?.RBI ?? ""),
      },
    };

    while (safe[playerId].innings.length < INNINGS) {
      safe[playerId].innings.push("");
    }
  }

  return safe;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ratio(numerator, denominator) {
  if (!denominator) return ".000";
  return avgNumber(numerator / denominator);
}

function avgNumber(n) {
  return (Math.round(n * 1000) / 1000).toFixed(3);
}

function emptyStats() {
  return { PA: 0, AB: 0, H: 0, BB: 0, SF: 0, TB: 0 };
}

function emptyScoreRow() {
  return {
    innings: Array.from({ length: INNINGS }, () => ""),
    totals: { AB: "", R: "", H: "", RBI: "" },
  };
}

function initialState() {
  return {
    game: { away: 0, home: 0, inning: 1 },
    players: [],
    scorebook: {},
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
