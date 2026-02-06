// Sidebar open/close
const overlay = document.getElementById("overlay");
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const closeBtn = document.getElementById("closeBtn");

function openMenu() {
  overlay.classList.add("open");
  sidebar.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeMenu() {
  overlay.classList.remove("open");
  sidebar.classList.remove("open");
  document.body.style.overflow = "";
}

menuBtn?.addEventListener("click", openMenu);
closeBtn?.addEventListener("click", closeMenu);
overlay?.addEventListener("click", closeMenu);

document.querySelectorAll("[data-close]").forEach((a) => {
  a.addEventListener("click", () => closeMenu());
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

// Contact form copy-to-clipboard
const form = document.getElementById("contactForm");
const clearBtn = document.getElementById("clearBtn");
const toast = document.getElementById("toast");

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name")?.value?.trim() || "";
  const email = document.getElementById("email")?.value?.trim() || "";
  const msg = document.getElementById("msg")?.value?.trim() || "";

  const compiled =
`Ready Central Inquiry
Name: ${name || "(not provided)"}
Email: ${email || "(not provided)"}

Message:
${msg || "(no message)"}
`;

  try {
    await navigator.clipboard.writeText(compiled);
    showToast("Copied message to clipboard.");
  } catch (err) {
    // fallback
    const temp = document.createElement("textarea");
    temp.value = compiled;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
    showToast("Copied (fallback mode).");
  }
});

clearBtn?.addEventListener("click", () => {
  form?.reset();
  showToast("Cleared.");
});

// Footer year
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();
