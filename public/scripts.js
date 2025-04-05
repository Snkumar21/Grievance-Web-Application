// scripts.js

document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent form submission

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.getElementById('role').value;

    const errorElement = document.getElementById('error');

    // Basic validation
    if (!email || !password) {
        errorElement.textContent = 'All fields are required.';
        return;
    }

    // Send login details to the backend (example structure)
    const loginData = { email, password, role };

    // Replace this with your actual API call
    console.log('Logging in:', loginData);

    // Clear error on success (you can redirect or display a success message)
    errorElement.textContent = '';
});
