/**
 * Módulo de Gestión de Dashboard - INVERSIONES F Y E POP SRL
 */

let currentUserState = {
    nombre: 'Erisson Chevalier',
    cedula: '001-0000000-0',
    balanceDop: 250000.00,
    balanceUsd: 1500.00,
    movimientos: [
        {
            fecha: '2026-10-10',
            descripcion: 'Apertura de Cuenta Regulada (Ley 3-12)',
            tipo: 'Depósito',
            monto: 250000.00,
            moneda: 'DOP',
            estado: 'Completado'
        }
    ]
};

const formatCurrency = (amount, currency = 'DOP') => {
    return new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
};

function renderDashboard(userData = currentUserState) {
    const elName = document.getElementById('dash-user-name');
    const elCedula = document.getElementById('dash-user-cedula');
    const elBalanceDop = document.getElementById('dash-balance-dop');
    const elBalanceUsd = document.getElementById('dash-balance-usd');
    const elMontoInicial = document.getElementById('dash-monto-inicial');

    if (elName) elName.textContent = userData.nombre;
    if (elCedula) elCedula.textContent = userData.cedula;
    if (elBalanceDop) elBalanceDop.textContent = formatCurrency(userData.balanceDop, 'DOP');
    if (elBalanceUsd) elBalanceUsd.textContent = formatCurrency(userData.balanceUsd, 'USD');
    if (elMontoInicial && userData.movimientos.length > 0) {
        elMontoInicial.textContent = formatCurrency(userData.movimientos[0].monto, 'DOP');
    }

    renderTablaMovimientos(userData.movimientos);
}

function renderTablaMovimientos(movimientos) {
    const tbody = document.getElementById('dash-tabla-movimientos');
    if (!tbody) return;

    tbody.innerHTML = movimientos.map(mov => {
        const badgeTipo = mov.tipo === 'Depósito'
            ? 'bg-green-100 text-fye-verde'
            : 'bg-amber-100 text-amber-700';

        return `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-3 font-semibold text-slate-800">${mov.fecha}</td>
                <td class="p-3">${mov.descripcion}</td>
                <td class="p-3">
                    <span class="${badgeTipo} text-[10px] font-bold px-2 py-0.5 rounded">${mov.tipo}</span>
                </td>
                <td class="p-3 font-bold text-slate-900">${formatCurrency(mov.monto, mov.moneda)}</td>
                <td class="p-3">
                    <span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">${mov.estado}</span>
                </td>
            </tr>
        `;
    }).join('');
}

function handleLogout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        const dashboardSection = document.getElementById('section-dashboard');
        if (dashboardSection) {
            dashboardSection.classList.add('hidden');
        }
        console.log('Sesión finalizada correctamente.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('dash-tabla-movimientos')) {
        renderDashboard();
    }
});

window.FyeDashboard = {
    currentUserState,
    renderDashboard,
    renderTablaMovimientos,
    handleLogout,
    formatCurrency
};
