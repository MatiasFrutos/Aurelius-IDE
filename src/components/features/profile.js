// src/components/features/profile.js — perfil del usuario: nombre y foto circular, visibles en la barra superior y/o derecha
import { t } from "../../app/i18n.js";
import { toastError, toastSuccess } from "../ui/toast.js";
import { closeOverlay, openOverlay } from "./features.js";

const KEY = "aurelius.profile.v1";
const AVATAR_SIZE = 192;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const DEFAULTS = { name: "", avatar: "", show: "topbar" };

export function getProfile() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setProfile(patch) {
  const next = { ...getProfile(), ...patch };

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error(t("No hay espacio para guardar el perfil.", "No space to save the profile."));
  }

  return next;
}

export function profileShows(place) {
  const { show } = getProfile();

  return show === "both" || show === place;
}

export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return "";

  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Avatar circular: foto → iniciales → icono genérico.
export function avatarHtml(size = 28) {
  const { name, avatar } = getProfile();
  const style = `--au-avatar-size:${size}px`;

  if (avatar) {
    return `<span class="au-avatar" style="${style}"><img src="${esc(avatar)}" alt="${esc(name || "Perfil")}" draggable="false" /></span>`;
  }

  const initials = initialsOf(name);

  return `<span class="au-avatar is-fallback" style="${style}">${initials ? `<b>${esc(initials)}</b>` : `<i data-lucide="user"></i>`}</span>`;
}

// Recorta al centro y reduce la foto a un cuadrado pequeño (JPEG) para guardarla en localStorage.
export function processPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error(t("Elegí un archivo de imagen.", "Choose an image file.")));
    if (file.size > MAX_INPUT_BYTES) return reject(new Error(t("La imagen supera los 8 MB.", "The image is over 8 MB.")));

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");

      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      canvas.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t("No se pudo leer la imagen.", "Could not read the image.")));
    };

    img.src = url;
  });
}

const rerender = () => window.dispatchEvent(new CustomEvent("au:rerender"));

export function openProfile() {
  const draft = { ...getProfile() };
  const places = [["topbar", t("Barra superior", "Top bar")], ["right", t("Barra derecha", "Right bar")], ["both", t("Ambas", "Both")], ["none", t("Ocultar", "Hide")]];

  openOverlay({
    title: t("Mi perfil", "My profile"),
    icon: "user",
    width: 460,
    body: `<div class="au-prof">
      <div class="au-prof__avatar" data-prof-preview></div>
      <div class="au-prof__photo">
        <label class="au-fx-btn au-prof__upload">${t("Subir foto", "Upload photo")}<input type="file" accept="image/*" hidden data-prof-file /></label>
        <button type="button" class="au-prof__ghost" data-prof-remove>${t("Quitar foto", "Remove photo")}</button>
      </div>
      <label class="au-prof__field"><span>${t("Nombre", "Name")}</span><input type="text" maxlength="40" value="${esc(draft.name)}" placeholder="${esc(t("Tu nombre", "Your name"))}" data-prof-name spellcheck="false" /></label>
      <div class="au-prof__field"><span>${t("Mostrar mi foto en", "Show my photo in")}</span>
        <div class="au-prof__seg" role="radiogroup">${places.map(([v, l]) => `<button type="button" role="radio" data-prof-show="${v}" class="${draft.show === v ? "is-on" : ""}">${esc(l)}</button>`).join("")}</div>
      </div>
      <div class="au-prof__foot"><button type="button" class="au-fx-btn" data-prof-save>${t("Guardar", "Save")}</button></div>
    </div>`,
    onMount: (el) => {
      // Vista previa con el borrador (sin guardar todavía)
      const paintPreview = () => {
        el.querySelector("[data-prof-preview]").innerHTML = draftAvatar(draft, 88);
        window.lucide?.createIcons?.();
      };

      paintPreview();

      el.querySelector("[data-prof-name]").addEventListener("input", (e) => {
        draft.name = e.target.value;
        paintPreview();
      });

      el.querySelector("[data-prof-file]").addEventListener("change", async (e) => {
        try {
          draft.avatar = await processPhoto(e.target.files?.[0]);
          paintPreview();
        } catch (error) {
          toastError(String(error?.message || error), t("Perfil", "Profile"));
        }
        e.target.value = "";
      });

      el.querySelector("[data-prof-remove]").addEventListener("click", () => {
        draft.avatar = "";
        paintPreview();
      });

      el.querySelectorAll("[data-prof-show]").forEach((b) =>
        b.addEventListener("click", () => {
          draft.show = b.dataset.profShow;
          el.querySelectorAll("[data-prof-show]").forEach((x) => x.classList.toggle("is-on", x === b));
        })
      );

      el.querySelector("[data-prof-save]").addEventListener("click", () => {
        try {
          setProfile({ name: draft.name.trim(), avatar: draft.avatar, show: draft.show });
          closeOverlay();
          rerender();
          toastSuccess(t("Perfil guardado.", "Profile saved."), t("Perfil", "Profile"));
        } catch (error) {
          toastError(String(error?.message || error), t("Perfil", "Profile"));
        }
      });
    }
  });
}

function draftAvatar(draft, size) {
  const style = `--au-avatar-size:${size}px`;

  if (draft.avatar) return `<span class="au-avatar" style="${style}"><img src="${esc(draft.avatar)}" alt="" draggable="false" /></span>`;

  const initials = initialsOf(draft.name);

  return `<span class="au-avatar is-fallback" style="${style}">${initials ? `<b>${esc(initials)}</b>` : `<i data-lucide="user"></i>`}</span>`;
}

export function initProfile() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-profile-open]")) openProfile();
  });
}

export function createProfileCommands() {
  return [
    { id: "profile-edit", title: t("Perfil: editar mi perfil y foto", "Profile: edit my profile and photo"), description: t("Nombre, foto circular y dónde se muestra.", "Name, round photo and where it's shown."), group: t("Perfil", "Profile"), icon: "user", keywords: ["perfil", "profile", "foto", "avatar", "usuario"], run: openProfile }
  ];
}
