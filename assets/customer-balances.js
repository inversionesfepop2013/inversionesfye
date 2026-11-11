/* Customer balance renderer for the Supabase-authenticated portal.
 * Include after the Supabase client is initialized and call renderCustomerBalances().
 * Does not read Google Sheets, document numbers, or localStorage financial data.
 */
async function renderCustomerBalances() {
  const box = document.querySelector('#resumen-balances');
  if (!box) return;
  box.textContent = 'Cargando balances…';

  try {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session?.access_token) {
      box.textContent = 'Inicia sesión nuevamente para consultar tus balances.';
      return;
    }

    const response = await fetch('/api/customer-balances', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      credentials: 'same-origin'
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.detail || 'No disponible');

    const labels = {
      savings: 'Ahorro', certificate: 'Certificado', investment: 'Inversión',
      loan: 'Préstamo', foreign_exchange: 'Divisas'
    };
    const currency = (amount, code) => `${code || ''} ${Number(amount || 0).toLocaleString('es-DO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    const balances = Array.isArray(result.balances) ? result.balances : [];
    if (balances.length === 0) {
      box.textContent = 'Aún no tienes cuentas activas. Contacta a nuestra sucursal para solicitar una apertura.';
      return;
    }

    const table = document.createElement('table');
    table.className = 'w-full text-sm';
    const body = document.createElement('tbody');
    body.className = 'divide-y divide-slate-100';
    for (const account of balances) {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      name.className = 'py-2.5';
      name.textContent = labels[account.account_type] || 'Cuenta';
      const amount = document.createElement('td');
      amount.className = 'py-2.5 text-right font-semibold';
      amount.textContent = currency(account.balance, account.currency_code);
      row.append(name, amount);
      body.appendChild(row);
    }
    table.appendChild(body);
    box.replaceChildren(table);
  } catch (_) {
    // Keep database details and the old Google Sheets instructions out of the customer UI.
    box.textContent = 'No pudimos cargar tus balances en este momento. Intenta más tarde o comunícate con soporte.';
  }
}
