/* ============================================================
   Kridiya Travel — booking widget, airport autocomplete,
   custom date calendar, and search -> enquiry result panels.
   Requires: airports.js, main.js
   ============================================================ */
"use strict";

/* ---------- Airport autocomplete ---------- */
function searchAirports(q, limit) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = [], cityHits = [], other = [];
  for (let i = 0; i < AIRPORTS.length; i++) {
    const a = AIRPORTS[i]; // [IATA, city, country, name]
    const iata = a[0].toLowerCase(), city = a[1].toLowerCase(),
          country = a[2].toLowerCase(), name = a[3].toLowerCase();
    if (iata === q || iata.indexOf(q) === 0) starts.push(a);
    else if (city.indexOf(q) === 0) cityHits.push(a);
    else if (city.indexOf(q) > 0 || name.indexOf(q) >= 0 || country.indexOf(q) === 0) other.push(a);
    if (starts.length >= limit && cityHits.length >= limit) break;
  }
  return starts.concat(cityHits, other).slice(0, limit || 8);
}

let airportListId = 0;
function attachAirportAC(input) {
  if (input.dataset.acInit) return;
  input.dataset.acInit = "1";
  const field = input.closest(".field");
  const list = document.createElement("ul");
  list.className = "ac-list";
  list.id = "airport-options-" + (++airportListId);
  list.hidden = true;
  list.setAttribute("role", "listbox");
  field.appendChild(list);
  input.setAttribute("autocomplete", "off");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-autocomplete", "list");
  let items = [], active = -1;

  function close() {
    if (window.KridiyaMotion) KridiyaMotion.dropdown(list, false);
    else list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }
  function choose(a) {
    input.value = a[1] + " (" + a[0] + ")";
    input.dataset.iata = a[0];
    input.dataset.city = a[1];
    setFieldError(input, "");
    close();
  }
  function render() {
    if (!items.length) { close(); return; }
    list.innerHTML = items.map(function (a, i) {
      return '<li id="' + list.id + '-' + i + '" aria-selected="' + (i === active) + '" class="ac-item' + (i === active ? " active" : "") + '" role="option" data-i="' + i + '">' +
        '<span class="ac-code">' + a[0] + "</span>" +
        '<span class="ac-main"><span class="ac-city">' + a[1] + ", " + a[2] + "</span>" +
        '<span class="ac-name">' + a[3] + "</span></span></li>";
    }).join("");
    if (window.KridiyaMotion) KridiyaMotion.dropdown(list, true);
    else list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", list.id + '-' + active);
      list.children[active].scrollIntoView({ block: "nearest", behavior: "instant" });
    } else input.removeAttribute("aria-activedescendant");
  }

  input.addEventListener("input", function () {
    delete input.dataset.iata;
    items = searchAirports(input.value, 8);
    active = -1;
    render();
  });
  input.addEventListener("keydown", function (e) {
    if (input.getAttribute("aria-expanded") !== "true") return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % items.length; render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + items.length) % items.length; render(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(items[active]); }
    else if (e.key === "Escape") close();
  });
  list.addEventListener("pointerdown", function (e) {
    const li = e.target.closest(".ac-item");
    if (li) { e.preventDefault(); choose(items[+li.dataset.i]); }
  });
  let blurTimer;
  input.addEventListener("blur", function () { blurTimer = setTimeout(close, 120); });
  input.addEventListener("focus", function () { clearTimeout(blurTimer); });
}

/* Resolve a typed value to an airport even without a dropdown pick */
function resolveAirport(input) {
  if (input.dataset.iata) return { iata: input.dataset.iata, city: input.dataset.city };
  const m = input.value.match(/\(([A-Za-z]{3})\)\s*$/);
  const q = m ? m[1] : input.value;
  const hit = searchAirports(q, 1)[0];
  return hit ? { iata: hit[0], city: hit[1] } : null;
}

/* ---------- Custom calendar date picker ----------
   Every date field is a hidden <input type=hidden name=X> (holds the ISO
   value the rest of the app reads) plus a button that opens a styled
   month-grid popover. Replaces native <input type=date> everywhere so the
   calendar looks and behaves the same across browsers. */
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function isoOf(y, m, d) {
  return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function dateFieldHTML(id, name, label, opts) {
  opts = opts || {};
  let attrs = ' data-date-name="' + name + '"';
  if (opts.minToday !== false) attrs += ' data-min-today="1"';
  if (opts.maxToday) attrs += ' data-max-today="1"';
  if (opts.defaultOffset != null) attrs += ' data-default-offset="' + opts.defaultOffset + '"';
  if (opts.afterField) attrs += ' data-after-field="' + opts.afterField + '"';
  if (opts.minGapDays != null) attrs += ' data-min-gap-days="' + opts.minGapDays + '"';
  return (
    '<div class="field date-field"' + attrs + '>' +
      (opts.icon ? '<span class="booking-field-icon" aria-hidden="true">' + icon(opts.icon) + '</span>' : '') +
      '<label for="' + id + '">' + label + '</label>' +
      '<input type="hidden" name="' + name + '">' +
      '<button type="button" class="fake-input date-btn placeholder" id="' + id + '" aria-haspopup="true" aria-expanded="false">' +
        (opts.placeholder || "Select date") +
      "</button>" +
    "</div>"
  );
}

function monthFieldHTML(id, name, label, opts) {
  opts = opts || {};
  return (
    '<div class="field month-field" data-month-name="' + name + '"' + (opts.required === false ? '' : ' data-required="1"') + '>' +
      '<label for="' + id + '">' + label + '</label>' +
      '<input type="hidden" name="' + name + '">' +
      '<button type="button" class="fake-input month-btn placeholder" id="' + id + '" aria-haspopup="dialog" aria-expanded="false">' +
        (opts.placeholder || "Select month") +
      '</button>' +
    '</div>'
  );
}

function initMonthPickers(scope) {
  scope.querySelectorAll('.month-field').forEach(function (field) {
    if (field.dataset.mpInit) return;
    field.dataset.mpInit = '1';
    const name = field.dataset.monthName;
    const hidden = field.querySelector('input[type="hidden"][name="' + name + '"]');
    const btn = field.querySelector('.month-btn');
    const form = field.closest('form');
    const placeholder = btn.textContent;
    const pop = document.createElement('div');
    pop.className = 'cal-pop month-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', labelText(field.querySelector('label')) || 'Choose travel month');
    field.appendChild(pop);
    let year = new Date().getFullYear();

    function labelText(el) { return el ? el.textContent.trim() : ''; }
    function currentMonthValue() { return localISO(new Date()).slice(0, 7); }
    function setValue(value, silent) {
      hidden.value = value || '';
      if (value) {
        const parts = value.split('-');
        btn.textContent = MONTH_NAMES[Number(parts[1]) - 1] + ' ' + parts[0];
        btn.classList.remove('placeholder');
        setFieldError(btn, '');
      } else {
        btn.textContent = placeholder;
        btn.classList.add('placeholder');
      }
      if (!silent) hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
    field._monthSet = setValue;
    if (hidden.value) setValue(hidden.value, true);

    function render() {
      const minimum = currentMonthValue();
      pop.innerHTML =
        '<div class="cal-head">' +
          '<button type="button" class="cal-nav" data-dir="-1" aria-label="Previous year"' + (year <= Number(minimum.slice(0, 4)) ? ' disabled' : '') + '>' + icon('chevronLeft') + '</button>' +
          '<b>' + year + '</b>' +
          '<button type="button" class="cal-nav" data-dir="1" aria-label="Next year">' + icon('chevronRight') + '</button>' +
        '</div>' +
        '<div class="month-grid">' + MONTH_NAMES.map(function (month, index) {
          const value = year + '-' + String(index + 1).padStart(2, '0');
          const selected = value === hidden.value;
          return '<button type="button" class="month-cell' + (selected ? ' selected' : '') + '" data-month="' + value + '"' +
            (selected ? ' aria-pressed="true"' : ' aria-pressed="false"') + (value < minimum ? ' disabled' : '') + '>' + month.slice(0, 3) + '</button>';
        }).join('') + '</div>';
    }
    function open() {
      scope.querySelectorAll('.cal-pop').forEach(function (other) { if (other !== pop && other._close) other._close(); });
      year = hidden.value ? Number(hidden.value.slice(0, 4)) : new Date().getFullYear();
      render();
      if (window.KridiyaMotion) KridiyaMotion.dropdown(pop, true); else pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      if (pop.contains(document.activeElement)) btn.focus();
      if (window.KridiyaMotion) KridiyaMotion.dropdown(pop, false); else pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
    pop._close = close;
    btn.addEventListener('click', function (event) {
      event.stopPropagation();
      if (btn.getAttribute('aria-expanded') === 'true') close(); else open();
    });
    pop.addEventListener('click', function (event) {
      const nav = event.target.closest('.cal-nav');
      if (nav && !nav.disabled) {
        year += Number(nav.dataset.dir);
        const direction = nav.dataset.dir;
        render();
        const next = pop.querySelector('.cal-nav[data-dir="' + direction + '"]');
        if (next) next.focus();
        return;
      }
      const month = event.target.closest('.month-cell:not([disabled])');
      if (month) { setValue(month.dataset.month); close(); }
    });
    pop.addEventListener('keydown', function (event) {
      const month = event.target.closest('.month-cell');
      if (!month || !/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown)$/.test(event.key)) return;
      event.preventDefault();
      const enabled = Array.from(pop.querySelectorAll('.month-cell:not([disabled])'));
      const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
      const next = enabled[enabled.indexOf(month) + offset];
      if (next) next.focus();
    });
    document.addEventListener('pointerdown', function (event) { if (!pop.hidden && !field.contains(event.target)) close(); });
    document.addEventListener('keydown', function (event) { if (!pop.hidden && event.key === 'Escape') { close(); btn.focus(); } });
    if (form && field.dataset.required) {
      form.addEventListener('submit', function (event) {
        if (hidden.value) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setFieldError(btn, 'Choose a travel month.');
        btn.focus();
      }, true);
    }
  });
}

function initDatePickers(scope) {
  scope.querySelectorAll(".date-field").forEach(function (field) {
    if (field.dataset.dpInit) return;
    field.dataset.dpInit = "1";
    const name = field.dataset.dateName;
    const hidden = field.querySelector('input[type="hidden"][name="' + name + '"]');
    const btn = field.querySelector(".date-btn");
    const form = field.closest("form");
    const placeholderText = btn.textContent;

    const pop = document.createElement("div");
    pop.className = "cal-pop";
    pop.hidden = true;
    field.appendChild(pop);

    let viewY, viewM;

    function minISO() {
      let min = field.dataset.minToday ? todayISO(0) : null;
      if (field.dataset.afterField && form) {
        const otherField = form.querySelector('.date-field[data-date-name="' + field.dataset.afterField + '"]');
        const other = otherField && otherField.querySelector('input[type="hidden"]');
        if (other && other.value) {
          const d = new Date(other.value + "T00:00:00");
          d.setDate(d.getDate() + Number(field.dataset.minGapDays || 0));
          const afterISO = localISO(d);
          if (!min || afterISO > min) min = afterISO;
        }
      }
      return min;
    }
    function maxISO() {
      return field.dataset.maxToday ? todayISO(0) : null;
    }

    function setValue(iso, silent) {
      hidden.value = iso || "";
      if (iso) {
        if (window.KridiyaMotion && KridiyaMotion.label) KridiyaMotion.label(btn, fmtDate(iso), false);
        else btn.textContent = fmtDate(iso);
        btn.classList.remove("placeholder");
      } else {
        if (window.KridiyaMotion && KridiyaMotion.label) KridiyaMotion.label(btn, placeholderText, false);
        else btn.textContent = placeholderText;
        btn.classList.add("placeholder");
      }
      if (!silent) hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }
    field._dateSet = setValue;
    field._dateMin = minISO;
    field._dateMax = maxISO;
    if (hidden.value) setValue(hidden.value, true);

    function render() {
      const min = minISO();
      const max = maxISO();
      const first = new Date(viewY, viewM, 1);
      const startDow = first.getDay();
      const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
      const todayIso = todayISO(0);
      let cells = "";
      for (let i = 0; i < startDow; i++) cells += '<span class="cal-cell empty"></span>';
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = isoOf(viewY, viewM, d);
        const disabled = (min && iso < min) || (max && iso > max);
        const selected = hidden.value === iso;
        const isToday = iso === todayIso;
        const fullDate = new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        cells += '<button type="button" class="cal-cell' + (selected ? " selected" : "") + (isToday ? " today" : "") +
          '" data-iso="' + iso + '"' + (isToday ? ' aria-current="date"' : "") +
          ' aria-label="' + fullDate + '"' +
          (selected ? ' aria-pressed="true"' : ' aria-pressed="false"') + (disabled ? " disabled" : "") + '>' + d + "</button>";
      }
      const prevDisabled = min && new Date(viewY, viewM, 0) < new Date(min.slice(0, 4), +min.slice(5, 7) - 1, 1);
      const nextDisabled = max && localISO(new Date(viewY, viewM + 1, 1)) > max;
      pop.innerHTML =
        '<div class="cal-head">' +
          '<button type="button" class="cal-nav" data-dir="-1" aria-label="Previous month"' + (prevDisabled ? " disabled" : "") + ">" + icon("chevronLeft") + "</button>" +
          "<b>" + MONTH_NAMES[viewM] + " " + viewY + "</b>" +
          '<button type="button" class="cal-nav" data-dir="1" aria-label="Next month"' + (nextDisabled ? " disabled" : "") + ">" + icon("chevronRight") + "</button>" +
        "</div>" +
        '<div class="cal-dow">' + WEEKDAYS.map(function (w) { return "<span>" + w + "</span>"; }).join("") + "</div>" +
        '<div class="cal-grid">' + cells + "</div>";
    }

    function open() {
      scope.querySelectorAll(".cal-pop").forEach(function (p) { if (p !== pop) { if (p._close) p._close(); else p.hidden = true; } });
      const min = minISO();
      const max = maxISO();
      const base = hidden.value || min || max || todayISO(0);
      const cur = new Date(base + "T00:00:00");
      viewY = cur.getFullYear(); viewM = cur.getMonth();
      render();
      if (window.KridiyaMotion) KridiyaMotion.dropdown(pop, true);
      else pop.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    }
    function close() {
      if (pop.contains(document.activeElement)) btn.focus();
      if (window.KridiyaMotion) KridiyaMotion.dropdown(pop, false);
      else pop.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }

    pop._close = close;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (btn.getAttribute("aria-expanded") !== "true") open(); else close();
    });
    pop.addEventListener("click", function (e) {
      const nav = e.target.closest(".cal-nav");
      if (nav) {
        if (nav.disabled) return;
        viewM += +nav.dataset.dir;
        if (viewM < 0) { viewM = 11; viewY--; }
        if (viewM > 11) { viewM = 0; viewY++; }
        const direction = nav.dataset.dir;
        render();
        const nextNav = pop.querySelector('.cal-nav[data-dir="' + direction + '"]');
        if (nextNav) nextNav.focus();
        return;
      }
      const cell = e.target.closest(".cal-cell:not(.empty):not([disabled])");
      if (cell) { setValue(cell.dataset.iso); close(); }
    });
    document.addEventListener("pointerdown", function (e) {
      if (!pop.hidden && !field.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (!pop.hidden && e.key === "Escape") { close(); btn.focus(); }
    });
    pop.addEventListener("keydown", function (e) {
      const cell = e.target.closest(".cal-cell[data-iso]");
      if (!cell || !/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End)$/.test(e.key)) return;
      e.preventDefault();
      const enabled = Array.from(pop.querySelectorAll('.cal-cell[data-iso]:not([disabled])'));
      const index = enabled.indexOf(cell);
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      let nextIndex = index + (offsets[e.key] || 0);
      if (e.key === "Home") nextIndex = Math.max(0, index - new Date(cell.dataset.iso + "T00:00:00").getDay());
      if (e.key === "End") nextIndex = Math.min(enabled.length - 1, index + (6 - new Date(cell.dataset.iso + "T00:00:00").getDay()));
      if (enabled[nextIndex]) enabled[nextIndex].focus();
    });

    // When a preceding date (e.g. depart) changes, re-clamp this field if it's now invalid
    if (field.dataset.afterField && form) {
      const otherField = form.querySelector('.date-field[data-date-name="' + field.dataset.afterField + '"]');
      const otherHidden = otherField && otherField.querySelector('input[type="hidden"]');
      if (otherHidden) {
        otherHidden.addEventListener("change", function () {
          const min = minISO();
          if (min && hidden.value && hidden.value < min) setValue(min);
        });
      }
    }
  });
}

function applyDateDefaults(scope) {
  scope.querySelectorAll(".date-field[data-default-offset]").forEach(function (field) {
    const hidden = field.querySelector('input[type="hidden"]');
    if (hidden && !hidden.value && field._dateSet) {
      let iso = todayISO(+field.dataset.defaultOffset);
      const min = field._dateMin ? field._dateMin() : null;
      if (min && iso < min) iso = min;
      field._dateSet(iso, true);
    }
  });
}

function getDateField(form, name) {
  return form.querySelector('.date-field[data-date-name="' + name + '"]');
}
function setDateFieldValue(form, name, iso) {
  const f = getDateField(form, name);
  if (f && f._dateSet) f._dateSet(iso);
}
function getDateFieldValue(form, name) {
  const f = getDateField(form, name);
  return f ? f.querySelector('input[type="hidden"]').value : "";
}

/* ---------- Travellers popover ---------- */
function initPaxPopover(panel) {
  const btn = panel.querySelector(".pax-btn");
  const pop = panel.querySelector(".pax-pop");
  if (!btn || !pop || btn.dataset.paxInit) return;
  btn.dataset.paxInit = "1";
  const counts = { adults: 1, children: 0, infants: 0 };
  const MAXTOTAL = 9;
  function setOpen(open) {
    if (!open && pop.contains(document.activeElement)) btn.focus();
    if (window.KridiyaMotion) KridiyaMotion.dropdown(pop, open, "top-right");
    else pop.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  }

  function label() {
    const total = counts.adults + counts.children + counts.infants;
    const cls = pop.querySelector('select[name="class"]').value;
    const value = total + " Traveller" + (total > 1 ? "s" : "") + " · " + cls;
    if (window.KridiyaMotion && KridiyaMotion.label) KridiyaMotion.label(btn, value, false);
    else btn.textContent = value;
    btn.dataset.adults = counts.adults;
    btn.dataset.children = counts.children;
    btn.dataset.infants = counts.infants;
    btn.dataset.class = cls;
  }
  function refresh() {
    pop.querySelectorAll(".pax-row").forEach(function (row) {
      const k = row.dataset.kind;
      if (window.KridiyaMotion && KridiyaMotion.text) KridiyaMotion.text(row.querySelector("output"), counts[k]);
      else row.querySelector("output").textContent = counts[k];
      const total = counts.adults + counts.children + counts.infants;
      row.querySelector('[data-dir="-1"]').disabled = counts[k] <= (k === "adults" ? 1 : 0);
      if (k === "adults" && counts.adults <= counts.infants) row.querySelector('[data-dir="-1"]').disabled = true;
      row.querySelector('[data-dir="1"]').disabled =
        total >= MAXTOTAL || (k === "infants" && counts.infants >= counts.adults);
    });
    label();
  }
  pop.addEventListener("click", function (e) {
    const b = e.target.closest("button[data-dir]");
    if (b) {
      const kind = b.closest(".pax-row").dataset.kind;
      const next = counts[kind] + +b.dataset.dir;
      if (kind === "adults" && next < counts.infants) return;
      counts[kind] = next;
      refresh();
    }
    if (e.target.closest(".done")) { setOpen(false); btn.focus(); }
  });
  pop.querySelector("select").addEventListener("change", label);
  btn.addEventListener("click", function () {
    setOpen(btn.getAttribute("aria-expanded") !== "true");
  });
  document.addEventListener("pointerdown", function (e) {
    if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) {
      setOpen(false);
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && btn.getAttribute("aria-expanded") === "true") {
      setOpen(false); btn.focus();
    }
  });
  refresh();
}

/* ---------- Multi-city flight segments ---------- */
const MAX_SEGMENTS = 4;

function segmentHTML(index) {
  return (
    '<div class="mc-seg" data-seg="' + index + '">' +
      '<div class="mc-seg-num">Leg ' + (index + 1) + "</div>" +
      '<div class="mc-seg-fields">' +
        '<div class="field"><label for="mc-from-' + index + '">FROM</label>' +
          '<input id="mc-from-' + index + '" data-airport data-seg-from="' + index + '" placeholder="City or airport" required></div>' +
        '<div class="field"><label for="mc-to-' + index + '">TO</label>' +
          '<input id="mc-to-' + index + '" data-airport data-seg-to="' + index + '" placeholder="City or airport" required></div>' +
        dateFieldHTML("mc-date-" + index, "seg-date-" + index, "DATE", { defaultOffset: 3 + index * 3 }) +
      "</div>" +
      (index >= 2 ? '<button type="button" class="mc-remove" data-remove="' + index + '" aria-label="Remove this flight">' + icon("trash") + "</button>" : '<span class="mc-remove-spacer"></span>') +
    "</div>"
  );
}

function initMultiCity(ff) {
  const mc = ff.querySelector(".mc-segments");
  if (!mc || mc.dataset.mcInit) return;
  mc.dataset.mcInit = "1";
  const addBtn = ff.querySelector(".mc-add");
  let nextSegmentId = Math.max(-1, ...Array.from(mc.children, function (seg) { return Number(seg.dataset.seg); })) + 1;

  function wireSegment(seg) {
    seg.querySelectorAll("input[data-airport]").forEach(attachAirportAC);
    initDatePickers(seg);
    applyDateDefaults(seg);
  }
  function renumber() {
    Array.from(mc.children).forEach(function (seg, i) {
      seg.querySelector(".mc-seg-num").textContent = "Leg " + (i + 1);
    });
    addBtn.hidden = mc.children.length >= MAX_SEGMENTS;
  }

  // First two segments ship in the markup already; wire them.
  Array.from(mc.children).forEach(wireSegment);

  addBtn.addEventListener("click", function () {
    if (mc.children.length >= MAX_SEGMENTS) return;
    const div = document.createElement("div");
    div.innerHTML = segmentHTML(nextSegmentId++);
    const seg = div.firstElementChild;
    mc.appendChild(seg);
    wireSegment(seg);
    renumber();
  });
  mc.addEventListener("click", function (e) {
    const rm = e.target.closest(".mc-remove");
    if (rm) { rm.closest(".mc-seg").remove(); renumber(); }
  });
  renumber();
}

/* ---------- Service picker carousel (home page only) ----------
   One draggable strip of icon+label cards, snapped to center. Dragging
   or swiping browses; tapping the already-centered card is what "chooses"
   it and follows its link — tapping an off-center card just centers it
   first, so a stray tap mid-swipe can't launch the wrong page. */
function initServiceCarousel(root) {
  const track = root.querySelector(".carousel-track");
  if (!track) return;
  const slides = Array.from(track.querySelectorAll(".service-slide"));
  let activeIndex = 0, dragging = false, dragged = false, startX = 0, startScroll = 0;

  const prevBtn = root.querySelector(".carousel-nav-btn.prev");
  const nextBtn = root.querySelector(".carousel-nav-btn.next");
  function setActive(i) {
    activeIndex = i;
    slides.forEach(function (s, idx) { s.classList.toggle("active", idx === i); });
    if (prevBtn) prevBtn.disabled = i <= 0;
    if (nextBtn) nextBtn.disabled = i >= slides.length - 1;
  }
  function nearestIndex() {
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    slides.forEach(function (s, idx) {
      const mid = s.offsetLeft + s.offsetWidth / 2;
      const dist = Math.abs(mid - center);
      if (dist < bestDist) { bestDist = dist; best = idx; }
    });
    return best;
  }
  // Desktop drops the horizontal slide for a plain crossfade (handled
  // entirely by CSS on the .active class — see the min-width:700px rules);
  // only mobile/tablet needs the scrollLeft animation below.
  const desktopFade = window.matchMedia("(min-width: 700px)");

  // Native scrollTo({behavior:"smooth"}) fights (or is silently ignored
  // by) a scroll-snap container in some browsers, so the glide is driven
  // by hand: step scrollLeft itself every frame, snap switched off for
  // the duration so it can't settle back mid-animation.
  let snapRestoreTimer, animFrame;
  function centerSlide(idx) {
    if (desktopFade.matches) { setActive(idx); return; }
    const s = slides[idx];
    const target = s.offsetLeft + s.offsetWidth / 2 - track.clientWidth / 2;
    const start = track.scrollLeft;
    const change = target - start;
    const duration = window.KridiyaMotion ? KridiyaMotion.duration("--page-slide-dur", track) : 320;
    if (!duration) {
      cancelAnimationFrame(animFrame); clearTimeout(snapRestoreTimer);
      track.style.scrollSnapType = ""; track.scrollLeft = target; setActive(idx); return;
    }
    const startTime = performance.now();
    track.style.scrollSnapType = "none";
    cancelAnimationFrame(animFrame);
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      if (window.KridiyaMotion && KridiyaMotion.reduced()) {
        track.scrollLeft = target; track.style.scrollSnapType = ""; setActive(idx); return;
      }
      const eased = window.KridiyaMotion ? KridiyaMotion.ease(t) : 1 - Math.pow(1 - t, 3);
      track.scrollLeft = start + change * eased;
      if (t < 1) { animFrame = requestAnimationFrame(step); }
    }
    animFrame = requestAnimationFrame(step);
    clearTimeout(snapRestoreTimer);
    snapRestoreTimer = setTimeout(function () { track.style.scrollSnapType = ""; }, duration + 60);
  }
  let scrollTimer;
  track.addEventListener("scroll", function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { setActive(nearestIndex()); }, 80);
  });

  // Touch swiping is native; this just adds click-and-drag panning for mice/trackpads.
  track.addEventListener("pointerdown", function (e) {
    cancelAnimationFrame(animFrame);
    clearTimeout(snapRestoreTimer);
    track.style.scrollSnapType = "";
    if (e.pointerType === "touch") return;
    dragging = true; dragged = false;
    startX = e.clientX; startScroll = track.scrollLeft;
    track.setPointerCapture(e.pointerId);
    track.classList.add("dragging");
  });
  track.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) dragged = true;
    track.scrollLeft = startScroll - dx;
  });
  function endDrag() { dragging = false; track.classList.remove("dragging"); }
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("pointerleave", function () { if (dragging) endDrag(); });

  // Only one slide is ever visible at a time now (it fills the whole box),
  // so there's no "peeking neighbour" to protect against — any plain tap
  // on it should navigate immediately. Only a genuine drag suppresses that.
  slides.forEach(function (s) {
    s.addEventListener("click", function (e) {
      if (dragged) { e.preventDefault(); }
    });
  });

  if (prevBtn) prevBtn.addEventListener("click", function () { if (activeIndex > 0) { setActive(activeIndex - 1); centerSlide(activeIndex); } });
  if (nextBtn) nextBtn.addEventListener("click", function () { if (activeIndex < slides.length - 1) { setActive(activeIndex + 1); centerSlide(activeIndex); } });

  setActive(0);
}

/* ---------- Widget forms ---------- */
function initSearchWidget(root) {
  if (!root) return;
  const tabsBar = root.querySelector(".widget-tabs");
  if (tabsBar) {
    root.querySelectorAll(".widget-tab").forEach(function (tab) {
      const panel = root.querySelector('.widget-panel[data-tab="' + tab.dataset.tab + '"]');
      tab.id = root.id + '-tab-' + tab.dataset.tab;
      panel.id = root.id + '-panel-' + tab.dataset.tab;
      tab.setAttribute("aria-controls", panel.id);
      panel.setAttribute("aria-labelledby", tab.id);
      panel.setAttribute("role", "tabpanel");
    });
    const activate = function (key, animate) {
      root.classList.toggle("motion-instant", !animate);
      root.querySelectorAll(".widget-tab").forEach(function (b) {
        const on = b.dataset.tab === key;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", String(on));
      });
      if (window.KridiyaMotion && KridiyaMotion.tabs) KridiyaMotion.tabs(tabsBar, tabsBar.querySelector('[aria-selected="true"]'), animate);
      root.querySelectorAll(".widget-panel").forEach(function (p) {
        const wasHidden = p.hidden;
        p.hidden = p.dataset.tab !== key;
        if (!p.hidden && wasHidden && animate && window.KridiyaMotion) KridiyaMotion.enterPanel(p);
      });
      void root.offsetWidth;
      root.classList.remove("motion-instant");
    };
    tabsBar.addEventListener("click", function (e) {
      const b = e.target.closest(".widget-tab");
      if (b) activate(b.dataset.tab, e.detail > 0);
    });
    const cur = root.querySelector(".widget-tab.active");
    activate(cur ? cur.dataset.tab : "flights");
  } else {
    // Solo service pages: the single panel is always shown.
    root.querySelectorAll(".widget-panel").forEach(function (p) { p.hidden = false; });
  }
  initServiceCarousel(root);

  /* Flights */
  const ff = root.querySelector('form[data-tab-form="flights"]');
  if (ff) {
    ff.querySelectorAll("input[data-airport]").forEach(attachAirportAC);
    initDatePickers(ff);
    applyDateDefaults(ff);
    initPaxPopover(ff);
    initMultiCity(ff);

    const segRow = ff.querySelector(".seg-row");
    const mcWrap = ff.querySelector(".mc-wrap");
    const paxField = segRow.querySelector(".pax-field");
    function tripChanged() {
      const trip = ff.trip.value;
      const oneWay = trip === "oneway";
      const multi = trip === "multicity";
      if (multi && paxField.parentElement !== mcWrap) mcWrap.appendChild(paxField);
      if (!multi && paxField.parentElement !== segRow) segRow.appendChild(paxField);
      segRow.hidden = multi;
      mcWrap.hidden = !multi;
      const returnField = getDateField(ff, "return");
      if (returnField) {
        returnField.style.opacity = oneWay ? 0.45 : 1;
        returnField.querySelector(".date-btn").disabled = oneWay;
        if (!oneWay && !getDateFieldValue(ff, "return")) setDateFieldValue(ff, "return", todayISO(6));
      }
    }
    ff.querySelectorAll('input[name="trip"]').forEach(function (r) { r.addEventListener("change", tripChanged); });
    tripChanged();

    const swap = ff.querySelector(".swap-btn");
    swap.addEventListener("click", function () {
      const a = ff.querySelector('input[name="from"]'), b = ff.querySelector('input[name="to"]');
      const tv = a.value, ti = a.dataset.iata, tc = a.dataset.city;
      a.value = b.value; b.value = tv;
      if (b.dataset.iata) { a.dataset.iata = b.dataset.iata; a.dataset.city = b.dataset.city; } else { delete a.dataset.iata; }
      if (ti) { b.dataset.iata = ti; b.dataset.city = tc; } else { delete b.dataset.iata; }
      swap.classList.toggle("spun");
    });

    ff.addEventListener("submit", function (e) {
      e.preventDefault();
      const pax = ff.querySelector(".pax-btn").dataset;

      if (ff.trip.value === "multicity") {
        const segs = Array.from(ff.querySelectorAll(".mc-seg"));
        const legs = [];
        let bad = false, prevDate = null;
        segs.forEach(function (seg, i) {
          const fromInput = seg.querySelector("[data-seg-from]");
          const toInput = seg.querySelector("[data-seg-to]");
          const from = resolveAirport(fromInput);
          const to = resolveAirport(toInput);
          const date = getDateFieldValue(seg, "seg-date-" + seg.dataset.seg);
          if (!from) { setFieldError(fromInput, "Pick a departure city."); bad = true; }
          if (!to) { setFieldError(toInput, "Pick a destination city."); bad = true; }
          if (from && to && from.iata === to.iata) { setFieldError(toInput, "Must differ from departure."); bad = true; }
          if (!date) { setFieldError(seg.querySelector(".date-btn"), "Choose a date."); bad = true; }
          else if (prevDate && date < prevDate) { setFieldError(seg.querySelector(".date-btn"), "Should not be before the previous flight."); bad = true; }
          if (date) prevDate = date;
          if (from && to && date) legs.push({ from: from.iata, fromCity: from.city, to: to.iata, toCity: to.city, date: date });
        });
        if (bad) { const firstInvalid = ff.querySelector('[aria-invalid="true"]'); if (firstInvalid) firstInvalid.focus(); return; }
        const p = new URLSearchParams({ trip: "multicity", legs: legs.length, adults: pax.adults, children: pax.children, infants: pax.infants, cabin: pax.class });
        legs.forEach(function (l, i) {
          p.set("seg" + i + "from", l.from); p.set("seg" + i + "fromCity", l.fromCity);
          p.set("seg" + i + "to", l.to); p.set("seg" + i + "toCity", l.toCity);
          p.set("seg" + i + "date", l.date);
        });
        location.href = "flights.html?" + p.toString();
        return;
      }

      const from = resolveAirport(ff.querySelector('input[name="from"]'));
      const to = resolveAirport(ff.querySelector('input[name="to"]'));
      let bad = false;
      if (!from) { setFieldError(ff.querySelector('input[name="from"]'), "Pick a departure city from the list."); bad = true; }
      if (!to) { setFieldError(ff.querySelector('input[name="to"]'), "Pick a destination city from the list."); bad = true; }
      if (from && to && from.iata === to.iata) { setFieldError(ff.querySelector('input[name="to"]'), "Destination must differ from departure."); bad = true; }
      const departVal = getDateFieldValue(ff, "depart");
      if (!departVal) { setFieldError(ff.querySelector(".date-field[data-date-name='depart'] .date-btn"), "Choose a departure date."); bad = true; }
      if (bad) { const firstInvalid = ff.querySelector('[aria-invalid="true"]'); if (firstInvalid) firstInvalid.focus(); return; }
      const p = new URLSearchParams({
        trip: ff.trip.value,
        from: from.iata, fromCity: from.city,
        to: to.iata, toCity: to.city,
        depart: departVal,
        adults: pax.adults, children: pax.children, infants: pax.infants,
        cabin: pax.class
      });
      const returnVal = getDateFieldValue(ff, "return");
      if (ff.trip.value === "round" && returnVal) p.set("return", returnVal);
      location.href = "flights.html?" + p.toString();
    });
  }

  /* Hotels */
  const hf = root.querySelector('form[data-tab-form="hotels"]');
  if (hf) {
    initDatePickers(hf);
    applyDateDefaults(hf);
    hf.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!hf.city.value.trim()) { setFieldError(hf.city, "This field is required."); return; }
      const checkin = getDateFieldValue(hf, "checkin"), checkout = getDateFieldValue(hf, "checkout");
      if (!checkin) { setFieldError(hf.querySelector(".date-field[data-date-name='checkin'] .date-btn"), "Choose a check-in date."); return; }
      if (!checkout) { setFieldError(hf.querySelector(".date-field[data-date-name='checkout'] .date-btn"), "Choose a check-out date."); return; }
      const p = new URLSearchParams({
        city: hf.city.value.trim(), checkin: checkin, checkout: checkout,
        rooms: hf.rooms.value, guests: hf.guests.value
      });
      location.href = "hotels.html?" + p.toString();
    });
  }

  /* Holidays */
  const yf = root.querySelector('form[data-tab-form="holidays"]');
  if (yf) {
    yf.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validateForm(yf)) return;
      const p = new URLSearchParams({ dest: yf.dest.value, month: yf.month.value, nights: yf.nights.value });
      location.href = "holidays.html?" + p.toString() + "#enquire";
    });
  }

  /* Umrah */
  const uf = root.querySelector('form[data-tab-form="umrah"]');
  if (uf) {
    initDatePickers(uf);
    applyDateDefaults(uf);
    uf.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validateForm(uf)) return;
      const p = new URLSearchParams({ dest: uf.dest.value, city: uf.city.value, nights: uf.nights.value });
      const d = getDateFieldValue(uf, "umdate");
      if (d) p.set("umdate", d);
      location.href = "umrah.html?" + p.toString() + "#enquire";
    });
  }

  /* Cruise */
  const cf = root.querySelector('form[data-tab-form="cruise"]');
  if (cf) {
    initDatePickers(cf);
    applyDateDefaults(cf);
    cf.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validateForm(cf)) return;
      const p = new URLSearchParams({ dest: cf.dest.value, line: cf.line.value, nights: cf.nights.value });
      const sail = getDateFieldValue(cf, "saildate");
      if (sail) p.set("saildate", sail);
      location.href = "cruise.html?" + p.toString() + "#enquire";
    });
  }

  /* Visa */
  const vf = root.querySelector('form[data-tab-form="visa"]');
  if (vf) {
    initDatePickers(vf);
    vf.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validateForm(vf)) return;
      const p = new URLSearchParams({ country: vf.country.value, nationality: vf.nationality.value.trim() });
      const travel = getDateFieldValue(vf, "travel");
      if (travel) p.set("travel", travel);
      location.href = "visa.html?" + p.toString() + "#apply";
    });
  }
}

/* ---------- Widget HTML (shared across pages) ---------- */
const WIDGET_TABS = [
  ["flights", "Flights", "plane", "Request flight options",
    "We compare available fare options and send clear prices and conditions for your approval."],
  ["hotels", "Hotels", "hotel", "Request hotel options",
    "Send the destination, dates, guests and room preference to request available hotel rates."],
  ["holidays", "Holidays", "suitcase", "Find Packages",
    "We combine available flights, hotels and transfers based on your dates, budget and preferences."],
  ["umrah", "Umrah", "kaaba", "Find Umrah Packages",
    "Request transport, hotel, room occupancy and visa assistance options for your group."],
  ["cruise", "Cruise", "ship", "Find Cruises",
    "Send the sailing, dates, cabin preference and add-ons needed for a current quote."],
  ["visa", "Visa", "passport", "Check Visa Options",
    "Send your destination and nationality to ask about available visa application assistance."],
  ["corporate", "Corporate", "users", "Corporate Booking",
    "Company flights, visas, hotels and group travel — billed to your company with one reference."]
];

function flightsPanelHTML() {
  return (
    '<div class="widget-panel" data-tab="flights" role="tabpanel" hidden>' +
    '<form data-tab-form="flights" novalidate>' +
      '<div class="trip-type" role="radiogroup" aria-label="Trip type">' +
        '<label><input type="radio" name="trip" value="round" checked> Round Trip</label>' +
        '<label><input type="radio" name="trip" value="oneway"> One Way</label>' +
        '<label><input type="radio" name="trip" value="multicity"> Multi City</label>' +
      "</div>" +
      '<div class="seg-row">' +
        '<div class="field seg-3"><label for="fl-from">FROM</label>' +
          '<input id="fl-from" name="from" data-airport placeholder="City or airport" required>' +
          '<button type="button" class="swap-btn" aria-label="Swap departure and destination">' + icon("swap") + "</button></div>" +
        '<div class="field seg-3"><label for="fl-to">TO</label>' +
          '<input id="fl-to" name="to" data-airport placeholder="City or airport" required></div>' +
        dateFieldHTML("fl-depart", "depart", "DEPART", { defaultOffset: 3, placeholder: "Add date", icon: "calendar" }).replace('class="field date-field"', 'class="field date-field seg-2"') +
        dateFieldHTML("fl-return", "return", "RETURN", { defaultOffset: 6, afterField: "depart", minGapDays: 0, placeholder: "Add date", icon: "calendar" }).replace('class="field date-field"', 'class="field date-field seg-2"') +
        '<div class="field seg-2 pax-field"><span class="booking-field-icon" aria-hidden="true">' + icon("users") + '</span><label id="pax-label">TRAVELLERS &amp; CLASS</label>' +
          '<button type="button" class="fake-input pax-btn" aria-haspopup="true" aria-expanded="false" aria-labelledby="pax-label">1 Traveller · Economy</button>' +
          '<div class="pax-pop" hidden>' +
            '<div class="pax-row" data-kind="adults"><span class="pax-label"><b>Adults</b><small>12+ years</small></span>' +
              '<span class="stepper"><button type="button" data-dir="-1" aria-label="Fewer adults">−</button><output>1</output><button type="button" data-dir="1" aria-label="More adults">+</button></span></div>' +
            '<div class="pax-row" data-kind="children"><span class="pax-label"><b>Children</b><small>2–11 years</small></span>' +
              '<span class="stepper"><button type="button" data-dir="-1" aria-label="Fewer children">−</button><output>0</output><button type="button" data-dir="1" aria-label="More children">+</button></span></div>' +
            '<div class="pax-row" data-kind="infants"><span class="pax-label"><b>Infants</b><small>Under 2, on lap</small></span>' +
              '<span class="stepper"><button type="button" data-dir="-1" aria-label="Fewer infants">−</button><output>0</output><button type="button" data-dir="1" aria-label="More infants">+</button></span></div>' +
            '<div class="field"><label for="fl-class">CABIN CLASS</label>' +
              '<select id="fl-class" name="class"><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></select></div>' +
            '<button type="button" class="btn btn-primary done">Done</button>' +
          "</div></div>" +
      "</div>" +
      '<div class="mc-wrap" hidden>' +
        '<div class="mc-segments">' + segmentHTML(0) + segmentHTML(1) + "</div>" +
        '<button type="button" class="mc-add">' + icon("plus") + " Add another flight</button>" +
      "</div>" +
      '<div class="widget-actions">' +
        '<button class="btn btn-primary btn-lg" type="submit">Request flight options</button></div>' +
    "</form></div>"
  );
}

function hotelsPanelHTML() {
  return (
    '<div class="widget-panel" data-tab="hotels" role="tabpanel" hidden>' +
    '<form data-tab-form="hotels" novalidate>' +
      '<div class="seg-row">' +
        '<div class="field seg-4"><label for="ht-city">DESTINATION / CITY</label>' +
          '<input id="ht-city" name="city" placeholder="e.g. Dubai, Ras Al Khaimah, London" required></div>' +
        dateFieldHTML("ht-in", "checkin", "CHECK-IN", { defaultOffset: 3, placeholder: "Add date" }).replace('class="field date-field"', 'class="field date-field seg-2"') +
        dateFieldHTML("ht-out", "checkout", "CHECK-OUT", { defaultOffset: 5, afterField: "checkin", minGapDays: 1, placeholder: "Add date" }).replace('class="field date-field"', 'class="field date-field seg-2"') +
        '<div class="field seg-2"><label for="ht-rooms">ROOMS</label>' +
          '<select id="ht-rooms" name="rooms"><option>1</option><option>2</option><option>3</option><option>4+</option></select></div>' +
        '<div class="field seg-2"><label for="ht-guests">GUESTS</label>' +
          '<select id="ht-guests" name="guests"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6+</option></select></div>' +
      "</div>" +
      '<div class="widget-actions">' +
        '<button class="btn btn-primary btn-lg" type="submit">Request hotel options</button></div>' +
    "</form></div>"
  );
}

function holidaysPanelHTML() {
  return (
    '<div class="widget-panel" data-tab="holidays" role="tabpanel" hidden>' +
    '<form data-tab-form="holidays" novalidate>' +
      '<div class="seg-row">' +
        '<div class="field seg-5"><label for="hd-dest">DESTINATION</label>' +
          '<select id="hd-dest" name="dest" required>' +
            "<option value=\"\">Choose a destination…</option>" +
            ["Dubai & UAE Staycation", "Georgia (Tbilisi)", "Azerbaijan (Baku)", "Thailand", "Bali, Indonesia", "Maldives", "Turkey (Istanbul)", "Europe (Schengen)", "Kerala, India", "Kashmir, India", "Sri Lanka", "Egypt (Cairo)", "Other — tell us!"].map(function (d) { return "<option>" + d + "</option>"; }).join("") +
          "</select></div>" +
        monthFieldHTML('hd-month', 'month', 'TRAVEL MONTH', { placeholder: 'Select month' }).replace('class="field month-field"', 'class="field month-field seg-4"') +
        '<div class="field seg-3"><label for="hd-nights">NIGHTS</label>' +
          '<select id="hd-nights" name="nights"><option>2–3</option><option selected>4–6</option><option>7–9</option><option>10+</option></select></div>' +
      "</div>" +
      '<div class="widget-actions">' +
        '<button class="btn btn-primary btn-lg" type="submit">Find Packages</button></div>' +
    "</form></div>"
  );
}

function umrahPanelHTML() {
  return (
    '<div class="widget-panel" data-tab="umrah" role="tabpanel" hidden>' +
    '<form data-tab-form="umrah" novalidate>' +
      '<div class="seg-row">' +
        '<div class="field seg-4"><label for="um-dest">UMRAH PACKAGE</label>' +
          '<select id="um-dest" name="dest" required>' +
            "<option value=\"\">Choose a package…</option>" +
            ["Economy Umrah by Bus (6 Nights)", "5 Nights Umrah by Air", "7 Nights Umrah — Makkah & Madinah", "5-star Umrah hotel options", "Ramadan Umrah options (10 Nights)", "Family & Group Umrah", "Other — add details below"].map(function (d) { return "<option>" + d + "</option>"; }).join("") +
          "</select></div>" +
        '<div class="field seg-3"><label for="um-city">DEPARTURE CITY</label>' +
          '<select id="um-city" name="city"><option>Dubai</option><option>Sharjah</option><option>Abu Dhabi</option><option>Ras Al Khaimah</option><option>Other UAE city</option></select></div>' +
        dateFieldHTML("um-date", "umdate", "PREFERRED DATE", { defaultOffset: 30, placeholder: "Add date" }).replace('class="field date-field"', 'class="field date-field seg-3"') +
        '<div class="field seg-2"><label for="um-nights">NIGHTS</label>' +
          '<select id="um-nights" name="nights"><option>5–6</option><option selected>7</option><option>10</option><option>14+</option></select></div>' +
      "</div>" +
      '<div class="widget-actions">' +
        '<button class="btn btn-primary btn-lg" type="submit">Find Umrah Packages</button></div>' +
    "</form></div>"
  );
}

function cruisePanelHTML() {
  return (
    '<div class="widget-panel" data-tab="cruise" role="tabpanel" hidden>' +
    '<form data-tab-form="cruise" novalidate>' +
      '<div class="seg-row">' +
        '<div class="field seg-4"><label for="cr-dest">CRUISE PACKAGE</label>' +
          '<select id="cr-dest" name="dest" required>' +
            "<option value=\"\">Choose a cruise…</option>" +
            ["Go Goa Gone (2 Nights)", "Lakshadweep Cruise (3 Nights)", "Lakshadweep & Goa Cruise (4 Nights)", "Jaffna Cruise (5 Nights)", "Coastal Odyssey (7 Nights)", "Other — tell us!"].map(function (d) { return "<option>" + d + "</option>"; }).join("") +
          "</select></div>" +
        '<div class="field seg-3"><label for="cr-line">CRUISE LINE</label>' +
          '<select id="cr-line" name="line"><option>Cordelia Cruises</option><option>Celestyal</option><option>MSC Cruises</option><option>Royal Caribbean</option><option>Other</option></select></div>' +
        dateFieldHTML("cr-date", "saildate", "SAILING DATE", { defaultOffset: 30, placeholder: "Add date" }).replace('class="field date-field"', 'class="field date-field seg-3"') +
        '<div class="field seg-2"><label for="cr-nights">NIGHTS</label>' +
          '<select id="cr-nights" name="nights"><option>2–3</option><option selected>4–6</option><option>7–9</option><option>10+</option></select></div>' +
      "</div>" +
      '<div class="widget-actions">' +
        '<button class="btn btn-primary btn-lg" type="submit">Find Cruises</button></div>' +
    "</form></div>"
  );
}

function visaPanelHTML() {
  return (
    '<div class="widget-panel" data-tab="visa" role="tabpanel" hidden>' +
    '<form data-tab-form="visa" novalidate>' +
      '<div class="seg-row">' +
        '<div class="field seg-5"><label for="vs-country">VISA FOR (COUNTRY)</label>' +
          '<select id="vs-country" name="country" required>' +
            "<option value=\"\">Choose a country…</option>" +
            ["United Arab Emirates", "Saudi Arabia (Umrah/Visit)", "Schengen (Europe)", "United Kingdom", "United States", "Canada", "Australia", "Turkey", "Georgia", "Azerbaijan", "Thailand", "Malaysia", "Singapore", "India", "Egypt", "Other"].map(function (c) { return "<option>" + c + "</option>"; }).join("") +
          "</select></div>" +
        '<div class="field seg-4"><label for="vs-nat">YOUR NATIONALITY</label>' +
          '<input id="vs-nat" name="nationality" placeholder="e.g. Indian, Filipino, Pakistani" required></div>' +
        dateFieldHTML("vs-date", "travel", "PLANNED TRAVEL DATE", { defaultOffset: 21, placeholder: "Add date" }).replace('class="field date-field"', 'class="field date-field seg-3"') +
      "</div>" +
      '<div class="widget-actions">' +
        '<button class="btn btn-primary btn-lg" type="submit">Check Visa Options</button></div>' +
    "</form></div>"
  );
}

/* Corporate is not a search — it's a signpost to the dedicated corporate
   booking form. Same tab, but the panel is a short pitch + a link out. */
function corporatePanelHTML() {
  return (
    '<div class="widget-panel widget-panel-cta" data-tab="corporate" role="tabpanel" hidden>' +
      '<div class="widget-cta">' +
        "<div>" +
          "<h3>Corporate &amp; business travel</h3>" +
          "<p>Request company flights, visas, hotels or group travel. Billing and LPO terms depend on account approval and the confirmed service.</p>" +
        "</div>" +
        '<a class="btn btn-primary btn-lg" href="https://corporate.kridiyatravel.com">Open business travel ' + icon("chevronRight") + "</a>" +
      "</div>" +
    "</div>"
  );
}

const PANEL_BUILDERS = { flights: flightsPanelHTML, hotels: hotelsPanelHTML, holidays: holidaysPanelHTML, umrah: umrahPanelHTML, cruise: cruisePanelHTML, visa: visaPanelHTML, corporate: corporatePanelHTML };

/* only: pass a single tab key ("flights"/"hotels"/"holidays"/"visa") to render
   just that vertical's form with no tab switcher — used on the dedicated pages
   so each page offers only the search relevant to it. Omit for the full
   4-tab portal switcher (home page). */
function searchWidgetHTML(only) {
  if (only && PANEL_BUILDERS[only]) {
    return '<div class="search-widget search-widget-solo" id="search-widget">' + PANEL_BUILDERS[only]() + "</div>";
  }
  // Home page: one draggable strip of service cards — no inline form here.
  // Choosing a card (drag/swipe to center it, then tap) hands off to that
  // service's own dedicated search page.
  return (
    '<div class="search-widget search-widget-carousel" id="search-widget">' +
    '<div class="carousel-track" role="group" aria-label="What would you like to book?">' +
    WIDGET_TABS.map(function (t) {
      return '<a class="service-slide" data-tab="' + t[0] + '" href="' + t[0] + '.html">' +
        '<span class="service-slide-label">' + t[1] + "</span>" +
        '<p class="service-slide-desc">' + t[4] + "</p>" +
        '<span class="service-slide-cta">' + t[3] + icon("chevronRight") + "</span>" +
      "</a>";
    }).join("") +
    "</div>" +
    '<button type="button" class="carousel-nav-btn prev" aria-label="Previous service">' + icon("chevronLeft") + "</button>" +
    '<button type="button" class="carousel-nav-btn next" aria-label="Next service">' + icon("chevronRight") + "</button>" +
    "</div>"
  );
}

/* Home page: a real tabbed search widget (Flights / Hotels / Holidays /
   Umrah / Cruise / Visa) so visitors can search directly instead of clicking
   through to a service page. Reuses the exact same PANEL_BUILDERS as the solo
   service pages, so the forms stay identical and proven. */
function searchWidgetTabbedHTML(activeTab) {
  const active = PANEL_BUILDERS[activeTab] ? activeTab : "flights";
  const tabs = WIDGET_TABS.map(function (t) {
    const key = t[0];
    return '<button type="button" class="widget-tab' + (key === active ? " active" : "") +
      '" role="tab" aria-selected="' + (key === active) + '" data-tab="' + key + '">' +
      icon(t[2]) + "<span>" + t[1] + "</span></button>";
  }).join("");
  const panels = WIDGET_TABS.map(function (t) { return PANEL_BUILDERS[t[0]](); }).join("");
  return '<div class="search-widget search-widget-tabbed" id="search-widget">' +
    '<div class="widget-tabs" role="tablist" aria-label="What would you like to book?">' + tabs + "</div>" +
    panels + "</div>";
}

/* ---------- Enquiry panel builder ---------- */
function escapeSearchHTML(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}

function enquiryFormHTML(opts) {
  const s = window.KridiyaAuth ? KridiyaAuth.session() : null;
  const u = s && KridiyaAuth.getUser ? (KridiyaAuth.getUser(s.email) || s) : null;
  const hidden = Object.keys(opts.details).map(function (k) {
    return '<input type="hidden" name="' + escapeSearchHTML(k) + '" value="' + escapeSearchHTML(opts.details[k]) + '">';
  }).join("");
  return (
    '<form class="form-grid" method="POST" action="https://formsubmit.co/' + KRIDIYA.emails.enquiry + '" data-formsubmit data-enquiry-type="' + escapeSearchHTML(opts.type) + '" novalidate>' +
      '<input type="hidden" name="_subject" value="' + escapeSearchHTML(opts.subject) + '">' +
      '<input type="hidden" name="_captcha" value="false">' +
      '<input type="hidden" name="_template" value="table">' +
      hidden +
      '<div class="field"><label for="search-request-name">YOUR NAME</label><input id="search-request-name" name="Name" autocomplete="name" placeholder="Full name" required value="' + escapeSearchHTML(u && u.name) + '"></div>' +
      '<div class="field"><label for="search-request-email">EMAIL</label><input id="search-request-email" name="Email" type="email" autocomplete="email" placeholder="you@example.com" required value="' + escapeSearchHTML(u && u.email) + '"></div>' +
      '<div class="field"><label for="search-request-phone">PHONE / WHATSAPP</label><input id="search-request-phone" name="Phone" type="tel" autocomplete="tel" placeholder="+971 …" required value="' + escapeSearchHTML(u && u.phone) + '"></div>' +
      '<div class="field"><label for="search-request-notes">ANYTHING ELSE? (OPTIONAL)</label><textarea id="search-request-notes" name="Notes" placeholder="Preferred airline, budget, flexible dates…"></textarea></div>' +
      '<label class="form-consent"><input type="checkbox" name="Marketing_consent" value="Yes"> Send me occasional travel offers by email. I can opt out at any time.</label>' +
      '<button class="btn btn-primary btn-block" type="submit">' + icon("mail") + " Send request</button>" +
      '<p class="form-note">This request goes to our team for review during business hours.</p>' +
    "</form>" +
    '<p class="or">— or —</p>' +
    '<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="' + waLink(opts.waText) + '">' + icon("whatsapp") + " Get a quote on WhatsApp</a>"
  );
}

const SORT_PILLS = [
  ["best", "Best", "Balanced price and duration across airlines"],
  ["cheapest", "Lower price", "Lower-priced available options, with baggage and fare conditions shown"],
  ["fastest", "Fastest", "Shortest total travel time — direct and single-stop options first"]
];

function sortPillsHTML() {
  return '<div class="sort-pills" role="tablist" aria-label="Sort preference">' +
    SORT_PILLS.map(function (s, i) {
      return '<button type="button" class="sort-pill' + (i === 0 ? " active" : "") + '" data-sort="' + s[0] + '">' + s[1] + "</button>";
    }).join("") + "</div>";
}
function initSortPills(mount) {
  const pills = mount.querySelector(".sort-pills");
  const note = mount.querySelector(".sort-note");
  if (!pills || !note) return;
  pills.addEventListener("click", function (e) {
    const btn = e.target.closest(".sort-pill");
    if (!btn) return;
    pills.querySelectorAll(".sort-pill").forEach(function (b) { b.classList.toggle("active", b === btn); });
    const s = SORT_PILLS.find(function (x) { return x[0] === btn.dataset.sort; });
    note.textContent = s[2];
    const input = mount.querySelector('input[name="Priority"]');
    if (input) input.value = s[1];
    const wa = mount.querySelector(".btn-wa");
    if (wa) {
      if (!wa.dataset.baseHref) wa.dataset.baseHref = wa.href;
      const url = new URL(wa.dataset.baseHref);
      const text = url.searchParams.get("text") || "";
      url.searchParams.set("text", text.replace(/\nPriority:.*$/m, "") + "\nPriority: " + s[1]);
      wa.href = url.href;
    }
  });
}

function renderResultPanel(mount, opts) {
  mount.innerHTML =
    '<div class="result-panel reveal">' +
      '<div class="result-summary">' +
        '<span class="rs-main">' + icon(opts.icon) + escapeSearchHTML(opts.title) + "</span>" +
        '<span class="rs-meta">' + opts.meta.map(function (m) { return "<span>" + escapeSearchHTML(m) + "</span>"; }).join("") + "</span>" +
      "</div>" +
      (opts.sortPills ? '<div class="sort-wrap"><p class="sort-label">Your priority</p>' + sortPillsHTML() + '<p class="sort-note form-note">' + SORT_PILLS[0][2] + "</p></div>" : "") +
      '<div class="result-body">' +
        "<div><h3>" + escapeSearchHTML(opts.bodyTitle) + "</h3><p>" + escapeSearchHTML(opts.bodyText) + "</p>" + (opts.extra || "") + "</div>" +
        '<div class="enquiry-side"><h3>Get your quote</h3>' +
        '<p class="form-note" style="margin-bottom:0.9rem">No payment now — we confirm current price and conditions with you first.</p>' +
        enquiryFormHTML(opts) + "</div>" +
      "</div>" +
    "</div>";
  mount.querySelectorAll("form[data-formsubmit]").forEach(prepareFormSubmit);
  if (opts.sortPills) {
    const form = mount.querySelector("form[data-formsubmit]");
    if (form) form.insertAdjacentHTML("afterbegin", '<input type="hidden" name="Priority" value="Best">');
  }
  if (opts.sortPills) initSortPills(mount);
  mount.querySelector(".reveal").classList.add("in");
  mount.scrollIntoView({ behavior: "smooth", block: "start" });
}

const AIRLINE_CHIPS = ["Emirates", "Etihad", "flydubai", "Air Arabia", "Air India Express", "IndiGo", "Qatar Airways", "Saudia", "Turkish Airlines", "Wizz Air"];

function airlinesHTML() {
  return '<div class="airline-row">' +
    AIRLINE_CHIPS.map(function (a) { return '<span class="airline-chip">' + a + "</span>"; }).join("") +
    "</div>";
}

/* ---------- Per-page result wiring ---------- */
function initFlightResults() {
  const mount = document.getElementById("results");
  if (!mount) return;
  const p = new URLSearchParams(location.search);

  if (p.get("trip") === "multicity" && +p.get("legs") > 0) {
    const n = Math.min(MAX_SEGMENTS, Math.floor(+p.get("legs")));
    const legs = [];
    for (let i = 0; i < n; i++) {
      legs.push({
        from: p.get("seg" + i + "from"), fromCity: p.get("seg" + i + "fromCity"),
        to: p.get("seg" + i + "to"), toCity: p.get("seg" + i + "toCity"),
        date: p.get("seg" + i + "date")
      });
    }
    const paxBits = [];
    if (+p.get("adults")) paxBits.push(p.get("adults") + " Adult" + (+p.get("adults") > 1 ? "s" : ""));
    if (+p.get("children")) paxBits.push(p.get("children") + " Child" + (+p.get("children") > 1 ? "ren" : ""));
    if (+p.get("infants")) paxBits.push(p.get("infants") + " Infant" + (+p.get("infants") > 1 ? "s" : ""));
    const routeShort = legs.map(function (l) { return l.from + "→" + l.to; }).join(" · ");
    const routeFull = legs.map(function (l) { return escapeSearchHTML(l.fromCity + " (" + l.from + ") → " + l.toCity + " (" + l.to + ") · " + fmtDate(l.date)); }).join("<br>");
    const waText = "Hello Kridiya Travel! Multi-city flight enquiry:\n" +
      legs.map(function (l) { return l.fromCity + " (" + l.from + ") -> " + l.toCity + " (" + l.to + ") on " + fmtDate(l.date); }).join("\n") +
      "\n" + paxBits.join(", ") + " · " + p.get("cabin");

    renderResultPanel(mount, {
      icon: "route",
      type: "Multi-city flight enquiry",
      title: routeShort,
      meta: [legs.length + " flights", paxBits.join(", "), p.get("cabin")],
      sortPills: true,
      bodyTitle: "Multi-city fares, quoted as one itinerary",
      bodyText: "Multi-city pricing can vary significantly by routing and ticket combination. Send the full route below and we will check connected itinerary options and explain the conditions.",
      extra: '<p style="font-size:0.9rem;color:var(--text-muted);margin:0.6rem 0 0">' + routeFull + "</p>" + airlinesHTML(),
      subject: "Multi-City Flight Enquiry: " + routeShort,
      waText: waText,
      details: { Route: legs.map(function (l) { return l.fromCity + " (" + l.from + ") to " + l.toCity + " (" + l.to + ") on " + fmtDate(l.date); }).join(" | "), Travellers: paxBits.join(", "), Cabin: p.get("cabin") }
    });
    return;
  }

  if (!p.get("from") || !p.get("to")) return;
  // A route shortcut prefills the widget; the customer chooses dates before requesting a quote.
  if (!p.get("depart")) return;
  const round = p.get("trip") === "round" && p.get("return");
  const paxBits = [];
  if (+p.get("adults")) paxBits.push(p.get("adults") + " Adult" + (+p.get("adults") > 1 ? "s" : ""));
  if (+p.get("children")) paxBits.push(p.get("children") + " Child" + (+p.get("children") > 1 ? "ren" : ""));
  if (+p.get("infants")) paxBits.push(p.get("infants") + " Infant" + (+p.get("infants") > 1 ? "s" : ""));
  const route = p.get("fromCity") + " (" + p.get("from") + ") " + (round ? "⇄" : "→") + " " + p.get("toCity") + " (" + p.get("to") + ")";
  const dates = fmtDate(p.get("depart")) + (round ? " — " + fmtDate(p.get("return")) : "");
  const waText = "Hello Kridiya Travel! Flight enquiry:\n" + route + "\n" + dates + "\n" + paxBits.join(", ") + " · " + p.get("cabin");

  renderResultPanel(mount, {
    icon: "plane",
    type: "Flight enquiry",
    title: route,
    meta: [dates, paxBits.join(", "), p.get("cabin")],
    sortPills: true,
    bodyTitle: "Review your flight enquiry",
    bodyText: "Choose your priority, then send the request. Our team will reply with current options, baggage details and fare conditions.",
    extra: airlinesHTML(),
    subject: "Flight Enquiry: " + route + " · " + dates,
    waText: waText,
    details: {
      Route: route, Trip: round ? "Round trip" : "One way", Dates: dates,
      Travellers: paxBits.join(", "), Cabin: p.get("cabin")
    }
  });
}

function initHotelResults() {
  const mount = document.getElementById("results");
  if (!mount) return;
  const p = new URLSearchParams(location.search);
  if (!p.get("city")) return;
  const stay = fmtDate(p.get("checkin")) + " — " + fmtDate(p.get("checkout"));
  const who = p.get("rooms") + " room(s), " + p.get("guests") + " guest(s)";
  renderResultPanel(mount, {
    icon: "hotel",
    type: "Hotel enquiry",
    title: "Hotels in " + p.get("city"),
    meta: [stay, who],
    bodyTitle: "Hotel options for " + p.get("city"),
    bodyText: "Tell us your budget and star preference for " + p.get("city") + ". We will send available hotel options with the quoted total and booking conditions.",
    subject: "Hotel Enquiry: " + p.get("city") + " · " + stay,
    waText: "Hello Kridiya Travel! Hotel enquiry:\n" + p.get("city") + "\n" + stay + "\n" + who,
    details: { City: p.get("city"), Stay: stay, Rooms_Guests: who }
  });
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", function () {
  const wrap = document.getElementById("widget-mount");
  if (wrap) {
    const only = document.body.dataset.widgetOnly || null;
    wrap.innerHTML = only
      ? searchWidgetHTML(only)
      : searchWidgetTabbedHTML(document.body.dataset.widgetTab || "flights");
    initSearchWidget(wrap.firstElementChild);

    // Reflect an incoming search (URL params) back into the widget
    const p = new URLSearchParams(location.search);
    const ff = wrap.querySelector('form[data-tab-form="flights"]');
    if (ff && p.get("trip") === "multicity" && +p.get("legs") > 0) {
      ff.querySelector('input[name="trip"][value="multicity"]').checked = true;
      ff.querySelector('input[name="trip"]').dispatchEvent(new Event("change"));
      const mc = ff.querySelector(".mc-segments");
      const n = Math.min(+p.get("legs"), MAX_SEGMENTS);
      while (mc.children.length < n) ff.querySelector(".mc-add").click();
      for (let i = 0; i < n; i++) {
        const seg = mc.children[i];
        const fromInput = seg.querySelector("[data-seg-from]"), toInput = seg.querySelector("[data-seg-to]");
        const fCity = p.get("seg" + i + "fromCity"), fIata = p.get("seg" + i + "from");
        const tCity = p.get("seg" + i + "toCity"), tIata = p.get("seg" + i + "to");
        if (fIata) { fromInput.value = fCity + " (" + fIata + ")"; fromInput.dataset.iata = fIata; fromInput.dataset.city = fCity; }
        if (tIata) { toInput.value = tCity + " (" + tIata + ")"; toInput.dataset.iata = tIata; toInput.dataset.city = tCity; }
        const d = p.get("seg" + i + "date");
        if (d) setDateFieldValue(seg, "seg-date-" + seg.dataset.seg, d);
      }
    } else if (ff && p.get("from") && p.get("to")) {
      const from = ff.querySelector('input[name="from"]'), to = ff.querySelector('input[name="to"]');
      from.value = p.get("fromCity") + " (" + p.get("from") + ")";
      from.dataset.iata = p.get("from"); from.dataset.city = p.get("fromCity");
      to.value = p.get("toCity") + " (" + p.get("to") + ")";
      to.dataset.iata = p.get("to"); to.dataset.city = p.get("toCity");
      if (p.get("depart")) setDateFieldValue(ff, "depart", p.get("depart"));
      const trip = p.get("trip") === "oneway" ? "oneway" : "round";
      ff.querySelector('input[name="trip"][value="' + trip + '"]').checked = true;
      ff.querySelector('input[name="trip"]').dispatchEvent(new Event("change"));
      if (p.get("return")) setDateFieldValue(ff, "return", p.get("return"));
    }
    const hf = wrap.querySelector('form[data-tab-form="hotels"]');
    if (hf && p.get("city")) {
      hf.city.value = p.get("city");
      if (p.get("checkin")) setDateFieldValue(hf, "checkin", p.get("checkin"));
      if (p.get("checkout")) setDateFieldValue(hf, "checkout", p.get("checkout"));
      if (p.get("rooms")) hf.rooms.value = p.get("rooms");
      if (p.get("guests")) hf.guests.value = p.get("guests");
    }
  }
  initFlightResults();
  initHotelResults();

  // Airport autocomplete for standalone data-airport fields outside the
  // search widget (e.g. the corporate booking form). Widget fields are
  // already initialised above, and attachAirportAC is a no-op if re-run.
  document.querySelectorAll("input[data-airport]").forEach(attachAirportAC);
  initDatePickers(document);
  initMonthPickers(document);
  applyDateDefaults(document);
});
