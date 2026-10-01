/* ============================================================================
   Pinecone Budget sheet
   ----------------------------------------------------------------------------
   ONE PAGE. The list of lines IS the budget, not a summary of one. Everything
   is visible at once, so you can watch the bottom line move when you change a
   number. That is the whole reason this shape beats a wizard.

   The seven curriculum steps are sections of this page, in order. Two of them
   (1 and 7) aren't data entry: one states the purpose, one reports the result.

   Money is typed once. Every other figure is derived. Nothing is stored.
   ========================================================================= */

const STEPS = [
  'Set your financial goals',
  'Estimate your after-tax income',
  'Fixed and variable expenses',
  'Debt payments',
  'Make room for precautionary saving',
  'Make room for further saving',
  'Review and revise',
];

/* ------------------------------------------------------------------ income */
/* `noun` names one pay period so "it varies" can ask for a slow and a good ONE
   OF THOSE, instead of saying "month" under a weekly cadence.

   `per` is how many payments land in a NORMAL month, not the annual average.
   Biweekly pay is 26 cheques a year, but 10 months of the year you get two and
   twice a year you get three. Budgeting on 26/12 = 2.17 means planning to spend
   money that is not in the account in ten months out of twelve, which is the
   wrong error to make for someone with no cushion. So we plan on two, and
   surface the extra cheques as what they are: extra.

   `yr` is the true count, used only to work out how much that extra comes to. */
const FREQS = [
  { id:'weekly',      label:'every week',   per:4,    yr:52, noun:'week' },
  { id:'biweekly',    label:'every 2 weeks',per:2,    yr:26, noun:'two weeks' },
  { id:'semimonthly', label:'twice a month',per:2,    yr:24, noun:'half-month' },
  { id:'monthly',     label:'every month',  per:1,    yr:12, noun:'month' },
  { id:'yearly',      label:'once a year',  per:1/12, yr:1,  noun:'year' },
];
const freqBy = (id) => FREQS.find((f) => f.id === id) || FREQS[3];

/* ---------------------------------------------------------------- expenses */
const EXP_FREQS = [
  { id:'monthly',   label:'/mo',   per:1 },
  { id:'quarterly', label:'/qtr',  per:1/3 },
  { id:'halfyear',  label:'/6mo',  per:1/6 },
  { id:'yearly',    label:'/yr',   per:1/12 },
];
const expFreqBy = (id) => EXP_FREQS.find((f) => f.id === id) || EXP_FREQS[0];

/* Each line: [label, 'F' fixed | 'V' variable, 'D' if it is debt].
   Fixed/variable is INFERRED, never asked. Most people sort it wrongly and
   being quizzed on it at data-entry time is the fastest way to lose someone.
   Rent is not debt; a mortgage is. Insurance sits with the thing it insures,
   so a subtotal answers "what does my car actually cost me?". */
const CATALOG = [
  { id:'housing', name:'Housing and utilities', lines:[
    ['Rent','F'], ['Mortgage','F','D'], ['Home or renters insurance','F'],
    ['Electricity','V'], ['Gas and water','V'], ['Phone','F'], ['Internet','F'] ] },
  { id:'transport', name:'Transportation', lines:[
    ['Car loan payment','F','D'], ['Car lease payment','F'], ['Car insurance','F'],
    ['Fuel','V'], ['Transit or parking','V'] ] },
  { id:'food', name:'Food', lines:[
    ['Groceries','V'], ['Dining out','V'] ] },
  { id:'debt', name:'Loans and credit', lines:[
    ['Student loan','F','D'],
    ['Credit card','F','D', 'Only count a card payment here if you carry a balance. '
      + 'If you clear it in full each month, that spending is already in the categories '
      + 'above, and counting it again would double it.'],
    ['Other loan','F','D'] ] },
  { id:'health', name:'Health and wellness', lines:[
    ['Health insurance','F'], ['Medical and prescriptions','V'], ['Personal care','V'] ] },
  { id:'subs', name:'Subscriptions and memberships', lines:[
    ['Streaming and apps','F'], ['Gym or memberships','F'] ] },
  { id:'fun', name:'Personal and fun', lines:[
    ['Clothing','V'], ['Going out and hobbies','V'], ['Travel and gifts','V'] ] },
  { id:'other', name:'Other commitments', lines:[
    ['Childcare','F'], ['Tuition or fees','F'] ] },
];

const mkLine = (label='', t='V', d=false) => ({ label, amount:'', freq:'monthly', t, d });
const makeGroups = () => CATALOG.map((g) => ({
  id:g.id, name:g.name, open:false,
  lines:g.lines.map(([label,t,d,info]) => ({ label, amount:'', freq:'monthly', t,
    d:d==='D', info:info||'' })),
}));

/* ------------------------------------------------------------------- state */
const MAX_GOALS = 3;
const state = {
  goals: [''],                 /* named only; the money for them lives in step 6 */
  openAll: false,
  openInfo: null,              /* which line's info note is showing */
  income: [ {label:'Main job', amount:'', freq:'biweekly', varies:false, low:'', high:''} ],
  groups: makeGroups(),
  emergency: '',
  saving: [ {label:'Retirement', amount:''}, {label:'', amount:''} ],
};

/* --------------------------------------------------------------- utilities */
const $  = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isFinite(n)?n:0; };
const usd = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();

/* ------------------------------------------------------------------- maths */
const incRowMonthly = (r) => (r.varies ? num(r.low) : num(r.amount)) * freqBy(r.freq).per;
function incomeTotals() {
  let plan = 0, upside = 0, anyVaries = false, extra = 0, extraCount = 0, anyYearly = false;
  state.income.forEach((r) => {
    const f = freqBy(r.freq);
    const base = r.varies ? num(r.low) : num(r.amount);
    plan += base * f.per;
    if (r.varies) { anyVaries = true; upside += Math.max(0, num(r.high) - num(r.low)) * f.per; }
    /* payments in a year beyond the twelve normal months we planned on */
    const spare = f.yr - f.per * 12;
    if (spare > 0 && base) { extra += base * spare; extraCount += spare; }
    if (r.freq === 'yearly' && base) anyYearly = true;
  });
  return { plan, upside, anyVaries, extra, extraCount, anyYearly };
}
const lineMonthly  = (l) => num(l.amount) * expFreqBy(l.freq).per;
const groupTotal   = (g) => g.lines.reduce((t,l) => t + lineMonthly(l), 0);
const expTotal     = () => state.groups.reduce((t,g) => t + groupTotal(g), 0);
function expSplit() {
  let fixed = 0, varies = 0;
  state.groups.forEach((g) => g.lines.forEach((l) => {
    const m = lineMonthly(l); if (l.t === 'F') fixed += m; else varies += m;
  }));
  return { fixed, varies };
}
const debtLines = () => {
  const out = [];
  state.groups.forEach((g) => g.lines.forEach((l) => {
    if (l.d && lineMonthly(l)) out.push({ label:l.label, amount:lineMonthly(l) });
  }));
  return out;
};
const debtTotal  = () => debtLines().reduce((t,l) => t + l.amount, 0);
const savingList = () => state.saving.filter((r) => num(r.amount));
const savingTotal = () => num(state.emergency)
  + state.saving.reduce((t,r) => t + num(r.amount), 0);
const outTotal = () => expTotal();
const left = () => incomeTotals().plan - outTotal() - savingTotal();

/* Three positions, named for what they are. Someone whose costs exceed their
   income has not "over-assigned" anything; they are short, and calling it the
   other thing is both inaccurate and a small accusation. Report the number,
   say where it came from, don't grade it. */
function position() {
  const inc = incomeTotals().plan;
  const before = inc - outTotal();
  const l = left();
  if (before < 0)  return { state:'short',         label:'Short by',                      before, l };
  if (l < 0)       return { state:'overcommitted', label:'Assigned beyond your income by', before, l };
  return { state:'ok', label:'Left to assign', before, l };
}

/* ======================================================= markup: the page */
const stepHead = (n, extra='') => `
  <div class="shead">
    <span class="snum">${n}</span>
    <h2>${esc(STEPS[n-1])}</h2>
    ${extra ? `<span class="stot" id="${extra}"></span>` : ''}
  </div>`;

function incomeRow(r, i) {
  const per = freqBy(r.freq).noun;
  const amt = r.varies
    ? `<div class="two">
         <label class="mini">A slow ${per}
           <span class="money"><i>$</i><input class="in" data-ii="${i}" data-ik="low"
             type="text" inputmode="decimal" value="${esc(r.low)}" /></span></label>
         <label class="mini">A good ${per}
           <span class="money"><i>$</i><input class="in" data-ii="${i}" data-ik="high"
             type="text" inputmode="decimal" value="${esc(r.high)}" /></span></label>
       </div>`
    : `<span class="money"><i>$</i><input class="in" data-ii="${i}" data-ik="amount"
         type="text" inputmode="decimal" value="${esc(r.amount)}" /></span>`;
  return `
    <div class="irow ${r.varies?'v':''}">
      <input class="in name" data-ii="${i}" data-ik="label" type="text"
             placeholder="${i===0?'Main job':'Other income'}" value="${esc(r.label)}" />
      ${amt}
      <select class="in sel" data-ii="${i}" data-ik="freq">
        ${FREQS.map((f)=>`<option value="${f.id}" ${r.freq===f.id?'selected':''}>${f.label}</option>`).join('')}
      </select>
      <span class="mo" id="incmo${i}">${incRowMonthly(r)?usd(incRowMonthly(r))+'/mo':''}</span>
      <label class="vary"><input type="checkbox" data-ivar="${i}" ${r.varies?'checked':''} /> varies</label>
      ${state.income.length>1?`<button class="x" data-irm="${i}" aria-label="Remove row">&times;</button>`:'<span></span>'}
    </div>`;
}

function costLine(l, gi, li) {
  const key = gi + '-' + li, open = state.openInfo === key;
  return `
    <div class="line">
      <span class="nmwrap">
        <input class="in name" data-gi="${gi}" data-li="${li}" data-lk="label" type="text"
               value="${esc(l.label)}" placeholder="What is it?" />
        ${l.info ? `<button class="info ${open?'on':''}" data-info="${key}"
          aria-expanded="${open?'true':'false'}" aria-label="About this line">i</button>` : ''}
      </span>
      <span class="money"><i>$</i><input class="in" data-gi="${gi}" data-li="${li}" data-lk="amount"
        type="text" inputmode="decimal" value="${esc(l.amount)}" /></span>
      <select class="in freq" data-gi="${gi}" data-li="${li}" data-lk="freq"
              aria-label="How often">
        ${EXP_FREQS.map((f)=>`<option value="${f.id}" ${l.freq===f.id?'selected':''}>${f.label}</option>`).join('')}
      </select>
      <button class="x" data-lrm="${li}" data-lg="${gi}" aria-label="Remove line">&times;</button>
    </div>
    ${open ? `<p class="infonote">${esc(l.info)}</p>` : ''}`;
}

/* Collapsed by default, because at a real lesson-column width the open page is
   ~4,000px and "see it all at once" is already lost. The closed row carries the
   category total, so the collapsed state IS the summary rather than a filing
   cabinet of empty labels. */
function groupCard(g, gi) {
  const tot = groupTotal(g);
  const filled = g.lines.filter((l) => num(l.amount)).length;
  return `
    <section class="cat ${g.open?'open':''}">
      <button class="cathead" data-gopen="${gi}" aria-expanded="${g.open?'true':'false'}">
        <h3>${esc(g.name)}</h3>
        <span class="catmeta">${filled?`${filled} line${filled>1?'s':''}`:''}</span>
        <span class="cattot" id="tot-${g.id}">${tot?usd(tot):''}</span>
        <svg class="chev" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"
          focusable="false"><path d="M3.5 6L8 10.5 12.5 6" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      ${g.open ? `<div class="catbody">
        ${g.lines.map((l,li)=>costLine(l,gi,li)).join('')}
        <button class="add" data-ladd="${gi}">+ add a line</button>
      </div>` : ''}
    </section>`;
}

function savingRow(r, i) {
  return `
    <div class="line">
      <input class="in name" data-si="${i}" data-sk="label" type="text"
             placeholder="What for?" value="${esc(r.label)}" />
      <span class="money"><i>$</i><input class="in" data-si="${i}" data-sk="amount"
        type="text" inputmode="decimal" value="${esc(r.amount)}" /></span>
      <span class="freq flat">/mo</span>
      ${state.saving.length>1?`<button class="x" data-srm="${i}" aria-label="Remove row">&times;</button>`:'<span></span>'}
    </div>`;
}

function render() {
  $('sheet').innerHTML = `
    <section class="sec">
      ${stepHead(1)}
      <p class="help">What do you want your budget to achieve? What financial goals do you
        want to focus on?</p>
      ${state.goals.map((g,i) => `
        <div class="goal">
          <input class="in" data-gl="${i}" type="text" value="${esc(g)}" />
          ${state.goals.length>1?`<button class="x" data-glrm="${i}" aria-label="Remove goal">&times;</button>`:''}
        </div>`).join('')}
      ${state.goals.length<MAX_GOALS
        ? '<button class="add" data-gladd="1">+ add a goal</button>' : ''}
    </section>

    <section class="sec">
      ${stepHead(2, 'tot-income')}
      <p class="help">Take-home, not salary. Enter what actually reaches your account after
        taxes and deductions. Include income from all sources: salary, side work, investment
        income.</p>
      ${state.income.map(incomeRow).join('')}
      <button class="add" data-iadd="1">+ add a source</button>
      <div id="incnotes"></div>
    </section>

    <section class="sec">
      ${stepHead(3, 'tot-exp')}
      <p class="help">Rent, insurance, and other recurring costs are fixed expenses. Costs
        like groceries, dining out, and entertainment are variable expenses. Reviewing past
        spending helps estimate these amounts. Saving comes in steps 5 and 6.</p>
      <button class="add allcats" data-allcats="1">${state.openAll
        ? 'Close all categories' : 'Open all categories'}</button>
      <div class="cats">${state.groups.map(groupCard).join('')}</div>
      <p class="split" id="split"></p>
    </section>

    <div class="trio">
    <section class="sec">
      ${stepHead(4)}
      <div id="debtbox"></div>
    </section>

    <section class="sec">
      ${stepHead(5)}
      <p class="help">Treat building an emergency fund as a mandatory expense.</p>
      <div class="line solo">
        <span class="name flat">Emergency saving</span>
        <span class="money"><i>$</i><input class="in" id="emergency" type="text"
          inputmode="decimal" value="${esc(state.emergency)}" /></span>
        <span class="freq flat">/mo</span>
        <span></span>
      </div>
      <p class="help" id="emscale"></p>
    </section>

    <section class="sec">
      ${stepHead(6, 'tot-saving')}
      <p class="help">What are you saving for beyond the emergency fund? Retirement, a down
        payment, a car, a move.</p>
      ${state.saving.map(savingRow).join('')}
      <button class="add" data-sadd="1">+ add a line</button>
    </section>
    </div>

    <section class="sec last">
      ${stepHead(7)}
      <div id="bottom"></div>
    </section>`;
  bind();
  refresh();
}

/* Only the derived readouts change as you type, so there is no full re-render
   and therefore no caret to put back. Structural changes re-render. */
function refresh() {
  const t = incomeTotals(), sp = expSplit(), pos = position(), dbt = debtTotal();

  state.income.forEach((r,i) => {
    const el = $('incmo'+i); if (el) el.textContent = incRowMonthly(r) ? usd(incRowMonthly(r))+'/mo' : '';
  });
  $('tot-income').innerHTML = t.plan ? usd(t.plan)+'<small>/mo</small>' : '';
  state.groups.forEach((g) => {
    const el = $('tot-'+g.id); if (el) el.textContent = groupTotal(g) ? usd(groupTotal(g)) : '';
  });
  $('tot-exp').innerHTML = expTotal() ? usd(expTotal())+'<small>/mo</small>' : '';
  $('tot-saving').innerHTML = savingTotal() ? usd(savingTotal())+'<small>/mo</small>' : '';

  $('split').innerHTML = expTotal()
    ? `Of that, <b>${usd(sp.fixed)}</b> is fixed and <b>${usd(sp.varies)}</b> varies. The
       variable part is where a budget has give in it.` : '';

  const notes = [];
  if (t.anyYearly) notes.push(`A once-a-year amount is spread across twelve months here. It
    only works if you set it aside when it arrives.`);
  if (t.anyVaries) notes.push(t.upside
    ? `Planning on ${usd(t.plan)}. A good month would add ${usd(t.upside)}.`
    : `The slow figure is what gets planned, so the budget holds in a bad month.`);
  $('incnotes').innerHTML = notes.map((n)=>`<p class="note">${n}</p>`).join('');

  $('emscale').innerHTML = expTotal()
    ? `A common rule of thumb is three to six months of expenses. On the costs above that is
       <b>${usd(expTotal()*3)}</b> to <b>${usd(expTotal()*6)}</b>. If that feels out of reach,
       a smaller amount still covers the small shocks that would otherwise go on a card.` : '';

  /* No input here. With three debts, one "pay extra" box has no answer to
     "extra toward which one", and the natural move is to raise that line in
     step 3 anyway. So this step does the job it is actually for: showing how
     much of the budget is committed to the past. */
  const dshare = t.plan ? Math.round((dbt / t.plan) * 100) : 0;
  $('debtbox').innerHTML = dbt ? `
    <div class="bbox">
      <div class="b big"><span>A month toward debt</span><b>${usd(dbt)}</b></div>
      ${debtLines().map((l)=>`<div class="b"><span>${esc(l.label)}</span><b>${usd(l.amount)}</b></div>`).join('')}
    </div>
    ${dshare ? `<p class="note"><b>${dshare}%</b> of income is going toward debt.</p>` : ''}`
    : `<p class="help">No debt payments in the lines above. Add a loan or card payment to the
       category it belongs to and it will show up here.</p>`;

  $('bottom').innerHTML = bottom(pos);

  /* the live readout is a slot for a number, so it stays empty until there is one */
  const liveOn = !!(t.plan || expTotal());
  $('livelab').textContent = liveOn ? pos.label : '';
  $('livenum').textContent = liveOn ? usd(Math.abs(left())) : '';

}

function bottom(pos) {
  const t = incomeTotals();

  /* The goals come back here as a plain restatement. No prompt, no check, no
     asking whether the budget serves them: a goal can be "feel in control of
     my spending", which no line item answers and no software should grade.
     Seeing your own words next to your own numbers is the whole mechanism. */
  const gs = state.goals.map((g) => g.trim()).filter(Boolean);
  const goalList = gs.length ? `
    <p class="lab first">Your goals</p>
    <ul class="goallist">${gs.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : '';

  if (!t.plan && !expTotal()) {
    return `${goalList}<p class="help">The numbers appear here once there is income or
      spending above.</p>`;
  }
  const rows = [
    ['Money in', usd(t.plan)],
    ['Money out', usd(outTotal())],
    ['Saving', usd(savingTotal())],
  ].map(([k,v]) => `<div class="b"><span>${k}</span><b>${v}</b></div>`).join('');

  /* Only say something when the number alone does not. When the budget simply
     balances, restating it under the panel is the same fact twice. */
  const say = pos.state === 'short'
    ? `The costs above come to ${usd(-pos.before)} more than your income, before any saving.
       Saving lines will not change that number; the income and expense lines will.`
    : pos.state === 'overcommitted'
      ? `Costs leave ${usd(pos.before)} a month and ${usd(savingTotal())} is assigned,
         which is ${usd(-pos.l)} more than there is.`
      : '';

  const movers = left() >= 0 ? '' : `
    <p class="lab">Where the number can move</p>
    <div class="dlist">
      ${[
        expSplit().varies ? ['Variable spending',
          `${usd(expSplit().varies)} a month, against ${usd(expSplit().fixed)} that is fixed.`] : null,
        savingTotal() ? ['What you assigned to saving',
          `${usd(savingTotal())} a month across emergency and further saving.`] : null,
        ['Recurring costs', 'Plans, bills and subscriptions renew until you change them.'],
        ['Income and support', 'Work, benefits and assistance change the other side.'],
      ].filter(Boolean).map(([h,d]) =>
        `<div class="d col"><b>${h}</b><span>${d}</span></div>`).join('')}
    </div>`;

  return `
    ${goalList}
    <div class="bbox">${rows}
      <div class="b big"><span>${pos.label}</span><b>${usd(Math.abs(left()))}</b></div>
    </div>
    ${say ? `<p class="note">${say}</p>` : ''}
    ${movers}
    <div class="acts">
      <button class="btn" id="printit">Print or save as PDF</button>
      <p class="help">Come back to this budget to check your progress and adjust it. A budget
        should evolve with your life. Nothing here is saved or sent anywhere, so print or save
        a copy if you want to keep it.</p>
    </div>`;
}

/* ----------------------------------------------------------------- wiring */
function bind() {
  document.querySelectorAll('[data-gl]').forEach((el) => {
    el.addEventListener('input', () => { state.goals[+el.dataset.gl] = el.value; });
  });

  document.querySelectorAll('[data-ii]').forEach((el) => {
    const i = +el.dataset.ii, k = el.dataset.ik;
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      state.income[i][k] = el.value;
      if (k === 'freq') return render();            /* the slow/good nouns change */
      refresh();
    });
  });
  document.querySelectorAll('[data-gi]').forEach((el) => {
    const gi = +el.dataset.gi, li = +el.dataset.li, k = el.dataset.lk;
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => { state.groups[gi].lines[li][k] = el.value; refresh(); });
  });
  document.querySelectorAll('[data-si]').forEach((el) => {
    const i = +el.dataset.si;
    el.addEventListener('input', () => { state.saving[i][el.dataset.sk] = el.value; refresh(); });
  });
  const em = $('emergency');
  em.addEventListener('input', () => { state.emergency = em.value; refresh(); });
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-iadd],[data-irm],[data-ivar],[data-ladd],[data-lrm],'
    + '[data-sadd],[data-srm],[data-gladd],[data-glrm],[data-gopen],[data-allcats],'
    + '[data-info],#printit');
  if (!el) return;
  const d = el.dataset;
  if (el.id === 'printit') { window.print(); return; }
  if (d.info) { state.openInfo = state.openInfo === d.info ? null : d.info; }
  else if (d.gladd) { if (state.goals.length < MAX_GOALS) state.goals.push(''); }
  else if (d.glrm !== undefined) {
    state.goals.splice(+d.glrm, 1);
    if (!state.goals.length) state.goals.push('');
  }
  else if (d.gopen !== undefined) { const g = state.groups[+d.gopen]; g.open = !g.open; }
  else if (d.allcats) {
    state.openAll = !state.openAll;
    state.groups.forEach((g) => { g.open = state.openAll; });
  }
  else if (d.iadd) state.income.push({label:'',amount:'',freq:'monthly',varies:false,low:'',high:''});
  else if (d.irm !== undefined) state.income.splice(+d.irm, 1);
  else if (d.ivar !== undefined) state.income[+d.ivar].varies = !state.income[+d.ivar].varies;
  else if (d.ladd !== undefined) state.groups[+d.ladd].lines.push(mkLine());
  else if (d.lrm !== undefined) state.groups[+d.lg].lines.splice(+d.lrm, 1);
  else if (d.sadd) state.saving.push({label:'',amount:''});
  else if (d.srm !== undefined) state.saving.splice(+d.srm, 1);
  render();
});

/* Open anything that already has money, plus the first one regardless, so the
   pattern is visible without a tap. Runs at boot; after this it is the user's. */
function openFilled() {
  state.groups.forEach((g) => { if (groupTotal(g)) g.open = true; });
  if (!state.groups.some((g) => g.open)) state.groups[0].open = true;
}
openFilled();

render();
