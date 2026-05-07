const button = document.getElementById('myButton');
const monthSelector = document.getElementById('month');
const yearSelector = document.getElementById('year');
const skipGLPICheckbox = document.getElementById('skipGLPI');
const statusText = document.getElementById('status');
const ticketLimitSelector = document.getElementById('ticketLimit')
const setPathButton = document.getElementById('setPath');
const showOperationsCheckbox = document.getElementById('showOperation');
const options = {
  month: '01',
  year: '2025',
  skipGLPI: false,
  ticketLimit: '500',
  showOperations: false
}

// Set the current month and year in the dropdowns
const currentDate = new Date();
monthSelector.value = currentDate.getMonth() >= 10 ? currentDate.getMonth() : "0" + (currentDate.getMonth() + 1); // Months are 0-indexed
options.month = monthSelector.value; // Store the selected month in options
yearSelector.value = currentDate.getFullYear();
options.year = yearSelector.value; // Store the selected year in options

// Add event listeners to update the options when the dropdowns change
monthSelector.addEventListener('change', function () {
  options.month = monthSelector.value.padStart(2, '0'); // Ensure two digits
});
yearSelector.addEventListener('change', function () {
  options.year = yearSelector.value;
});

skipGLPICheckbox.addEventListener('change', function () {
  options.skipGLPI = skipGLPICheckbox.checked;
});

showOperationsCheckbox.addEventListener('change', function () {
  options.showOperations = showOperationsCheckbox.checked;
});

ticketLimitSelector.addEventListener('change', function () {
  options.ticketLimit = ticketLimitSelector.value;
});

setPathButton.addEventListener('click', async function () {
  // disable the button to prevent multiple clicks
  setPathButton.disabled = true;
  const path = await window.scripts.setPath();
  // re-enable the button after the operation is complete
  setPathButton.disabled = false;
  if (path) {
    statusText.textContent = `Caminho defindo: ${path}`;
  } else {
    statusText.textContent = 'Caminho não definido!';
  }

  setTimeout(() => {
    statusText.textContent = 'O título da janela apresenta o status da operação.';
  }, 5000); // Clear the status text after 5 seconds
});
button.addEventListener('click', async function () {
  // disable the button to prevent multiple clicks
  button.disabled = true;
  const result = await window.scripts.generateOS(options)
  // re-enable the button after the operation is complete
  button.disabled = false;
  alert(result)
});