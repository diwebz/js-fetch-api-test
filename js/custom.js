// Initialize Icons
lucide.createIcons();

// --- 1. DYNAMIC JSON CONFIGURATION ---
// We fetch the configuration from the external file 'dummy_fee_detail.json'
let responseCatalog = null;

async function loadConfiguration() {
    try {
        // 'fetch' requests the file from the server/folder
        const response = await fetch('json/dummy_fee_detail.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // We convert the text response into a usable JS Object
        responseCatalog = await response.json();
        console.log("✅ Configuration loaded:", responseCatalog);
        
    } catch (e) {
        console.error("❌ Could not load dummy_fee_detail.json. Ensure you are running on a local server (localhost), not file://", e);
        showToast("System Error: Could not load response catalog. Check console.", 'error');
    }
}

// Trigger the load immediately when script runs
loadConfiguration();

// Helper to find message by code
function getMessageByCode(code) {
    // Safety check in case user submits before file loads (unlikely but good practice)
    if (!responseCatalog) return "System Loading... Please try again.";
    
    const found = responseCatalog.api_responses.find(item => item.code === code);
    return found ? found.message : "Unknown Error Occurred";
}

// --- STATE MANAGEMENT ---
let selectedCustomers = [];

// --- UI FUNCTIONS ---
function openModal() {
    document.getElementById('feeModal').classList.remove('hidden');
    document.getElementById('feeModal').classList.add('flex');
}

function closeModal() {
    document.getElementById('feeModal').classList.add('hidden');
    document.getElementById('feeModal').classList.remove('flex');
    resetForm();
}

function resetForm() {
    document.getElementById('addFeeForm').reset();
    selectedCustomers = [];
    renderSelectedCustomers();
}

// --- MULTI-SELECT SIMULATION (Like Select2) ---
function toggleCustomerDropdown() {
    const list = document.getElementById('customerDropdownList');
    list.style.display = list.style.display === 'block' ? 'none' : 'block';
}

function addCustomer(value) {
    if (!selectedCustomers.includes(value)) {
        selectedCustomers.push(value);
        renderSelectedCustomers();
        // Update hidden input for form submission
        document.getElementById('hiddenCustomerIds').value = JSON.stringify(selectedCustomers);
    }
    toggleCustomerDropdown();
}

function removeCustomer(value) {
    selectedCustomers = selectedCustomers.filter(c => c !== value);
    renderSelectedCustomers();
    document.getElementById('hiddenCustomerIds').value = JSON.stringify(selectedCustomers);
}

function renderSelectedCustomers() {
    const container = document.querySelector('.selected-tags');
    const placeholder = container.querySelector('.select-placeholder');
    
    // Clear existing tags (keep placeholder ref)
    container.innerHTML = '';

    if (selectedCustomers.length === 0) {
        const span = document.createElement('span');
        span.className = 'text-gray-400 text-sm self-center ml-2 select-placeholder';
        span.innerText = 'Select customers...';
        container.appendChild(span);
    } else {
        selectedCustomers.forEach(cust => {
            const tag = document.createElement('div');
            tag.className = 'tag';
            tag.innerHTML = `
                <span>${cust.split(':')[0]}</span>
                <span class="tag-close" onclick="removeCustomer('${cust}'); event.stopPropagation();">&times;</span>
            `;
            container.appendChild(tag);
        });
    }
}

// Close dropdown if clicked outside
window.onclick = function(event) {
    if (!event.target.closest('.multi-select-container')) {
        document.getElementById('customerDropdownList').style.display = 'none';
    }
}

// --- MOCK BACKEND API (The "Colleague's" Code) ---
// Updated to return CODES instead of messages
async function mockBackendApi(endpoint, method, data) {
    console.group("🔌 API Request Started"); // DevTools grouping
    console.log(`Endpoint: ${endpoint}`);
    console.log("Payload:", data);
    
    logToScreen('REQUEST', { endpoint, method, payload: data });

    // Simulate network delay (1 second)
    await new Promise(resolve => setTimeout(resolve, 1000));

    let response;

    // SIMULATE SERVER-SIDE VALIDATION
    // 1. Check Reservation ID
    if (!data.reservationId || data.reservationId.trim() === "") {
        response = { status: 400, success: false, code: "ERR_VALIDATION_001" };
        console.error("❌ Server Response:", response); // Shows red in DevTools
    }
    // 2. Check Amount
    else if (!data.amount || parseFloat(data.amount) <= 0) {
        response = { status: 400, success: false, code: "ERR_VALIDATION_002" };
        console.error("❌ Server Response:", response);
    }
    // 3. Check Customers
    else if (!data.customerIds || JSON.parse(data.customerIds).length === 0) {
        response = { status: 400, success: false, code: "ERR_VALIDATION_003" };
        console.error("❌ Server Response:", response);
    }
      // 4. Travel Type Check
    else if (!data.travelType) {
        response = { status: 400, success: false, code: "ERR_VALIDATION_004" };
        console.error("❌ Server Response:", response);
    }
    // Success Case
    else {
        response = {
            status: 201, // Created
            success: true,
            code: "SUCCESS_201",
            data: {
                id: Math.floor(Math.random() * 10000),
                ...data,
                createdAt: new Date().toISOString()
            }
        };
        console.log("✅ Server Response:", response); // Shows normal in DevTools
    }

    console.groupEnd(); // End DevTools grouping
    logToScreen('RESPONSE', response);
    return response;
}

// --- FORM HANDLING ---
async function handleSubmit(e) {
    e.preventDefault(); 
    
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    
    // 1. Collect Form Data
    const formData = new FormData(e.target);
    const dataPayload = Object.fromEntries(formData.entries());

    // 2. UI Loading State
    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending...`;

    try {
        // 3. Call the Mock API
        const response = await mockBackendApi('/api/v1/fee-details/create', 'POST', dataPayload);

        // 4. LOOK UP MESSAGE FROM JSON CATALOG
        const userMessage = getMessageByCode(response.code);

        if (response.success) {
            showToast(userMessage, 'success');
            closeModal();
            addTableRow(response.data);
        } else {
            // Show the error message found in the catalog
            showToast(userMessage, 'error');
        }

    } catch (err) {
        showToast("Critical Network Error", 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- HELPER FUNCTIONS ---

function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const colors = type === 'success' 
        ? 'bg-green-500 text-white border-green-600' 
        : 'bg-red-500 text-white border-red-600';

    toast.className = `toast px-6 py-4 rounded shadow-lg mb-3 font-medium ${colors} flex items-center gap-3 min-w-[300px]`;
    
    // Icon based on type
    const icon = type === 'success' 
        ? `<i data-lucide="check-circle" class="w-5 h-5"></i>` 
        : `<i data-lucide="alert-circle" class="w-5 h-5"></i>`;

    toast.innerHTML = `${icon} <span>${message}</span>`;
    
    container.appendChild(toast);
    lucide.createIcons(); // Re-render icons

    // Remove after 4 seconds
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function addTableRow(data) {
    const tbody = document.getElementById('feeTableBody');
    const row = document.createElement('tr');
    row.className = "bg-blue-50 animate-pulse"; // Highlight new row
    
    // Format customer IDs for display
    const custDisplay = JSON.parse(data.customerIds).map(c => c.split(':')[0]).join(', ');

    row.innerHTML = `
        <td class="p-4 font-mono text-gray-600">${data.reservationId}</td>
        <td class="p-4"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">${custDisplay}</span></td>
        <td class="p-4">${data.resType}</td>
        <td class="p-4">${data.travelType}</td>
        <td class="p-4 font-medium text-gray-900">$${parseFloat(data.amount).toFixed(2)}</td>
        <td class="p-4 text-green-600">Just Added</td>
    `;
    
    tbody.insertBefore(row, tbody.firstChild);
    
    // Remove animation class after a moment
    setTimeout(() => row.classList.remove('animate-pulse', 'bg-blue-50'), 2000);
}

function logToScreen(type, data) {
    const logBox = document.getElementById('apiLog');
    const entry = document.createElement('div');
    entry.className = "mb-2 border-b border-gray-800 pb-2";
    
    const color = type === 'REQUEST' ? 'text-blue-400' : (data.success ? 'text-green-400' : 'text-red-400');
    const time = new Date().toLocaleTimeString();

    entry.innerHTML = `
        <span class="text-gray-500">[${time}]</span> 
        <span class="${color} font-bold">${type}:</span> 
        <span class="text-gray-300 break-all">${JSON.stringify(data)}</span>
    `;
    
    logBox.prepend(entry);
}