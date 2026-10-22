
const form = document.querySelector("#chatForm");
const questionInput = document.querySelector("#question");
const messagesEl = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const sendButton = document.querySelector("#sendButton");
const imageInput = document.querySelector("#imageInput");
const imagePreview = document.querySelector("#imagePreview");
const previewImage = document.querySelector("#previewImage");

let messages = [];
let selectedImage = null;
let busy = false;

function addMessage(role, content, imageUrl = null) {
  const message = document.createElement("div");
  message.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "assistant" ? "∑" : "U";

  const body = document.createElement("div");
  body.className = "message-body";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "assistant" ? "MathGenius AI" : "Anda";

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = content;

  body.append(name);

  if (imageUrl) {
    const img = document.createElement("img");
    img.className = "image-in-chat";
    img.src = imageUrl;
    img.alt = "Gambar soalan yang dimuat naik";
    body.append(img);
  }

  body.append(text);
  message.append(avatar, body);
  messagesEl.append(message);

  return { message, text };
}

function scrollToBottom() {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });
}

function resetChat() {
  if (busy) return;

  messages = [];
  messagesEl.replaceChildren();
  welcome.hidden = false;
  selectedImage = null;
  imageInput.value = "";
  imagePreview.hidden = true;
  questionInput.value = "";
}

async function sendQuestion(text) {
  if (busy) return;

  const question = text.trim();
  const image = selectedImage;

  if (!question && !image) return;

  const prompt = question || "Tolong baca gambar ini dan selesaikan soalan Matematik langkah demi langkah.";

  welcome.hidden = true;
  addMessage("user", prompt, image);

  messages.push({
    role: "user",
    content: prompt
  });

  // Hadkan sejarah perbualan supaya permintaan tidak terlalu besar.
  messages = messages.slice(-12);

  selectedImage = null;
  imageInput.value = "";
  imagePreview.hidden = true;
  questionInput.value = "";

  busy = true;
  sendButton.disabled = true;
  sendButton.textContent = "…";

  const loading = addMessage("assistant", "Sedang menyelesaikan soalan anda…");
  scrollToBottom();

  try {
    const response = await fetch("/api/solve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages,
        imageDataUrl: image
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Permintaan gagal.");
    }

    loading.text.textContent = data.answer;
    messages.push({
      role: "assistant",
      content: data.answer
    });
  } catch (error) {
    loading.text.textContent =
      "Maaf, ada masalah: " + error.message +
      "\n\nSemak sama ada backend berjalan dan API key telah disediakan.";

    // Buang mesej pengguna yang gagal dihantar daripada sejarah AI.
    messages.pop();
  } finally {
    busy = false;
    sendButton.disabled = false;
    sendButton.textContent = "↑";
    questionInput.focus();
    scrollToBottom();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendQuestion(questionInput.value);
});

questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelector("#uploadButton").addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];

  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ];

  if (!allowedTypes.includes(file.type)) {
    alert("Pilih gambar JPEG, PNG, WEBP atau GIF.");
    imageInput.value = "";
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    alert("Saiz gambar maksimum ialah 4 MB.");
    imageInput.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    selectedImage = reader.result;
    previewImage.src = selectedImage;
    imagePreview.hidden = false;
  };

  reader.onerror = () => {
    alert("Gagal membaca gambar. Cuba gambar lain.");
  };

  reader.readAsDataURL(file);
});

document.querySelector("#removeImage").addEventListener("click", () => {
  selectedImage = null;
  imageInput.value = "";
  imagePreview.hidden = true;
  previewImage.removeAttribute("src");
});

document.querySelector("#newChat").addEventListener("click", resetChat);

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    sendQuestion(button.dataset.prompt);
  });
});

document.querySelector("#mobileMenu").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.toggle("open");
});
