const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const platformsNode = document.querySelector("#platforms");
const resultsNode = document.querySelector("#results");
const alertsNode = document.querySelector("#alerts");
const summaryTitle = document.querySelector("#summary-title");
const summaryDetail = document.querySelector("#summary-detail");
const sortSelect = document.querySelector("#sort");
const template = document.querySelector("#result-card-template");

let results = [];

const money = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

await boot();

async function boot() {
  const response = await fetch("/api/platforms");
  const { platforms } = await response.json();

  platformsNode.replaceChildren(...platforms.map((platform) => {
    const label = document.createElement("label");
    label.className = "platform-choice";
    label.innerHTML = `
      <input type="checkbox" value="${platform.id}" checked />
      <span>${platform.name}</span>
    `;
    return label;
  }));

  renderEmpty("\u53ef\u4ee5\u958b\u59cb\u641c\u5c0b\u3002");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await search();
});

sortSelect.addEventListener("change", renderResults);

async function search() {
  const platformIds = [...platformsNode.querySelectorAll("input:checked")]
    .map((input) => input.value)
    .join(",");

  const params = new URLSearchParams({
    q: queryInput.value,
    platforms: platformIds
  });

  summaryTitle.textContent = "\u641c\u5c0b\u4e2d";
  summaryDetail.textContent = "\u6b63\u5728\u67e5\u8a62\u5404\u5e73\u53f0\u50f9\u683c...";
  alertsNode.hidden = true;
  renderEmpty("\u641c\u5c0b\u4e2d\uff0c\u8acb\u7a0d\u5019\u3002");

  try {
    const response = await fetch(`/api/search?${params}`);
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "\u641c\u5c0b\u5931\u6557\u3002");
    }

    results = body.results || [];
    const priced = results.filter((item) => item.price !== null).length;
    summaryTitle.textContent = `${results.length} \u7b46\u7d50\u679c`;
    summaryDetail.textContent = `${priced} \u7b46\u542b\u89e3\u6790\u50f9\u683c\u3002\u5e73\u53f0\u64cb\u4e0b\u81ea\u52d5\u64f7\u53d6\u6642\u6703\u4fdd\u7559\u641c\u5c0b\u9023\u7d50\u3002`;

    if (body.errors?.length) {
      alertsNode.hidden = false;
      alertsNode.textContent = body.errors.map((error) => `${error.platformName}: ${error.message}`).join(" / ");
    }

    renderResults();
  } catch (error) {
    results = [];
    summaryTitle.textContent = "\u641c\u5c0b\u5931\u6557";
    summaryDetail.textContent = error.message;
    renderEmpty("\u6c92\u6709\u53ef\u986f\u793a\u7684\u7d50\u679c\u3002");
  }
}

function renderResults() {
  const sorted = [...results].sort((a, b) => {
    if (sortSelect.value === "platform") {
      return a.platformName.localeCompare(b.platformName, "zh-Hant");
    }

    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1;
    if (b.price === null) return -1;

    return sortSelect.value === "price-desc" ? b.price - a.price : a.price - b.price;
  });

  if (!sorted.length) {
    renderEmpty("\u6c92\u6709\u53ef\u986f\u793a\u7684\u7d50\u679c\u3002");
    return;
  }

  resultsNode.replaceChildren(...sorted.map(renderCard));
}

function renderCard(item) {
  const node = template.content.cloneNode(true);
  const image = node.querySelector("img");
  const imageFallback = node.querySelector(".media span");
  const platform = node.querySelector(".platform");
  const source = node.querySelector(".source");
  const title = node.querySelector("h2");
  const notice = node.querySelector(".notice");
  const price = node.querySelector(".price");
  const time = node.querySelector("time");
  const link = node.querySelector("a");

  if (item.imageUrl) {
    image.src = item.imageUrl;
    imageFallback.hidden = true;
  } else {
    image.remove();
  }

  platform.textContent = item.platformName;
  source.textContent = item.source === "marketplace" ? "\u5df2\u89e3\u6790" : "\u641c\u5c0b\u9023\u7d50";
  title.textContent = item.title;
  notice.textContent = item.notice || "";
  price.textContent = item.price === null ? "\u958b\u555f\u5e73\u53f0\u78ba\u8a8d" : money.format(item.price);
  time.dateTime = item.fetchedAt;
  time.textContent = formatDate(item.fetchedAt);
  link.href = item.url;
  link.textContent = item.price === null ? "\u641c\u5c0b" : "\u67e5\u770b";

  return node;
}

function renderEmpty(message) {
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = message;
  resultsNode.replaceChildren(empty);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
