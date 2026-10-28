document.getElementById("retry").addEventListener("click", () => window.location.reload());
const status = document.getElementById("connection");
const updateConnection = () => {
  status.textContent = navigator.onLine ? "Connection available. Tap Try again to continue." : "Waiting for an internet connection.";
};
window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
updateConnection();
