// Saves options to chrome.storage
const saveOptions = () => {
    const key = document.getElementById('lmnt_api_key');
    lmnt_api_key = key.value.trim();
    chrome.storage.sync.set(
      { lmnt_api_key },
      () => {
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(() => {
          status.textContent = '';
        }, 750);
      }
    );
  };

  // Restores api key value using the preferences stored in chrome.storage.
  const restoreOptions = () => {
    chrome.storage.sync.get(
      { lmnt_api_key: '' },
      (items) => {
        document.getElementById('lmnt_api_key').value = items.lmnt_api_key;
      }
    );
  };

  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);
