"use strict";
// ui.js — capa visual. No modifica la lógica de app.js, solo la envuelve.
// Debe cargarse DESPUÉS de app.js.

(() => {
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const ICONS = ["🎧", "🖱️", "⌨️", "🔊"];
    const shown = { capital: 0, sales: 0, profit: 0 };

    // ---------- PESTAÑAS ----------
    const tabButtons = document.querySelectorAll("#tabs button");
    tabButtons.forEach(btn => btn.addEventListener("click", () => {
        tabButtons.forEach(b => b.classList.remove("on"));
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("on"));
        btn.classList.add("on");
        document.getElementById(btn.dataset.tab).classList.add("on");
        if (btn.dataset.tab === "t-fin" && state) animateChart();
    }));

    // ---------- CONTADORES ANIMADOS ----------
    function countTo(id, from, to) {
        const el = $(id), t0 = performance.now();
        (function step(t) {
            const k = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - k, 3);
            el.textContent = money(from + (to - from) * e);
            if (k < 1) requestAnimationFrame(step);
        })(t0);
    }

    // ---------- GRÁFICA NUEVA (con área y animación) ----------
    function paintChart(p) {
        const canvas = $("capitalChart"), ctx = canvas.getContext("2d");
        if (!ctx || !state) return;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        const v = state.history.map(h => h.capital);
        const min = Math.min(0, ...v), max = Math.max(...v, 1), range = max - min || 1;
        const n = v.length;
        const x = i => 45 + (W - 65) * (n === 1 ? 0 : i / (n - 1));
        const y = val => H - 30 - (H - 55) * (val - min) / range;

        ctx.font = "12px 'Space Grotesk', Arial";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const val = min + range * i / 4, py = y(val);
            ctx.strokeStyle = css("--bd");
            ctx.beginPath(); ctx.moveTo(45, py); ctx.lineTo(W - 15, py); ctx.stroke();
            ctx.fillStyle = css("--muted");
            ctx.fillText(Math.round(val / 1000) + "k", 5, py + 4);
        }

        const limit = p * (n - 1), pts = [];
        for (let i = 0; i < n; i++) {
            if (i <= limit) pts.push([x(i), y(v[i])]);
            else if (i - 1 < limit) {
                const f = limit - (i - 1);
                pts.push([x(i - 1) + (x(i) - x(i - 1)) * f, y(v[i - 1]) + (y(v[i]) - y(v[i - 1])) * f]);
            }
        }
        if (pts.length > 1) {
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, "rgba(139,92,246,.45)");
            g.addColorStop(1, "rgba(6,182,212,0)");
            ctx.beginPath();
            ctx.moveTo(pts[0][0], H - 30);
            pts.forEach(q => ctx.lineTo(q[0], q[1]));
            ctx.lineTo(pts[pts.length - 1][0], H - 30);
            ctx.closePath(); ctx.fillStyle = g; ctx.fill();

            const lg = ctx.createLinearGradient(45, 0, W, 0);
            lg.addColorStop(0, "#8b5cf6"); lg.addColorStop(1, "#06b6d4");
            ctx.strokeStyle = lg; ctx.lineWidth = 3; ctx.lineJoin = "round";
            ctx.beginPath();
            pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
            ctx.stroke();
        }
        state.history.forEach((h, i) => {
            if (i > limit) return;
            ctx.fillStyle = "#06b6d4";
            ctx.beginPath(); ctx.arc(x(i), y(h.capital), 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = css("--muted");
            ctx.fillText(String(h.period), x(i) - 3, H - 8);
        });
    }
    function animateChart() {
        const t0 = performance.now();
        (function step(t) {
            const k = Math.min(1, (t - t0) / 900);
            paintChart(1 - Math.pow(1 - k, 3));
            if (k < 1) requestAnimationFrame(step);
        })(t0);
    }
    window.drawChart = () => paintChart(1);

    // ---------- RENDER ENVUELTO ----------
    const baseRender = render;
    render = function () {
        baseRender();
        if (!state) return;

        ["capital", "sales", "profit"].forEach(k => {
            if (shown[k] !== state[k]) countTo(k, shown[k], state[k]);
            shown[k] = state[k];
        });
        $("repBar").style.width = state.reputation + "%";

        document.querySelectorAll(".product").forEach((row, i) => {
            const p = state.products[i];
            const strong = row.querySelector("strong");
            if (!strong.textContent.startsWith(ICONS[i])) strong.textContent = ICONS[i] + " " + strong.textContent;
            const small = row.querySelector("small");
            small.classList.toggle("low", p.stock < 6);
            if (p.stock < 6) small.textContent = "⚠ " + small.textContent;
            const mg = document.createElement("span");
            mg.className = "mg";
            small.append(" · Margen ", mg);
            setMargin(row, p.price, p.cost);
        });
    };

    function setMargin(row, price, cost) {
        const mg = row.querySelector(".mg");
        if (!mg) return;
        const m = Math.round((price - cost) / price * 100);
        mg.textContent = (isFinite(m) ? m : 0) + "%";
        mg.classList.toggle("up", m >= 30);
        mg.classList.toggle("dn", m < 30);
    }
    $("inventory").addEventListener("input", e => {
        if (!e.target.classList.contains("price-input")) return;
        const row = e.target.closest(".product");
        const i = [...document.querySelectorAll(".product")].indexOf(row);
        if (i >= 0) setMargin(row, Number(e.target.value), state.products[i].cost);
    });

    // ---------- MODAL DE RESULTADOS ----------
    const ov = document.createElement("div");
    ov.className = "ov";
    ov.innerHTML = '<div class="modal" id="modalBox"></div>';
    document.body.append(ov);

    function showModal() {
        const recent = state.messages.slice(0, 4);
        const res = recent.find(m => m.title.startsWith("Resultados del mes"));
        const mis = recent.find(m => m.title.includes("Misión"));
        if (!res) return;
        const ok = mis && mis.title.includes("completada!");
        let html = `<h2>${ok ? "🎉" : "📉"} ${res.title}</h2>`;
        res.detail.split(". ").forEach(part => {
            const [k, ...rest] = part.replace(/\.$/, "").split(": ");
            if (!rest.length) return;
            const cls = /Utilidad/.test(k) ? (rest[0].includes("-") ? "dn" : "up") : "";
            html += `<div class="mr ${cls}"><span>${k}</span><b>${rest.join(": ")}</b></div>`;
        });
        if (mis) html += `<div class="mr ${ok ? "up" : "dn"}"><span>${mis.title}</span><b>${ok ? "✔" : "✘"}</b></div>`;
        const label = state.finished ? "Ver evaluación final →" : `Continuar al mes ${state.period} →`;
        html += `<button class="primary" id="modalOk">${label}</button>`;
        $("modalBox").innerHTML = html;
        ov.classList.add("on");
        $("modalOk").onclick = () => {
            ov.classList.remove("on");
            if (state.finished) $("finalReport").scrollIntoView({ behavior: "smooth" });
            else window.scrollTo({ top: 0, behavior: "smooth" });
        };
    }

    const baseNext = nextPeriod;
    nextPeriod = function () {
        if (!state || state.finished || state.eventChoice === null) return baseNext();
        const before = state.history.length;
        baseNext();
        if (state && state.history.length > before) showModal();
    };
})();