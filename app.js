import { createDatabase } from './db.js';

let db, state, cart = [], manualPaidEdited = false;
const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toFixed(2);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]);
const dateDisplay = (date) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(date));

function el(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
function button(label, className, click) { const b = el('button', label, className); b.type = 'button'; b.addEventListener('click', click); return b; }
async function save() { await db.write(state); }

function totals(userEdited = false) {
  if (userEdited) manualPaidEdited = true;
  const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
  const taxRate = Number($('taxRate').value) || 0, discount = Number($('discount').value) || 0;
  const taxAmount = subtotal * taxRate / 100, total = Math.max(0, subtotal + taxAmount - discount);
  if (!manualPaidEdited) $('paidAmount').value = total ? money(total) : '';
  const paid = Math.min(Math.max(Number($('paidAmount').value) || 0, 0), total), due = total - paid;
  $('subtotal').textContent = money(subtotal); $('grandTotal').textContent = money(total); $('dueAmount').textContent = money(due);
  return { subtotal, taxAmount, discount, total, paid, due };
}
function renderCart() { const body = $('billItems'); body.replaceChildren(); cart.forEach((item, i) => { const row = document.createElement('tr'); row.append(el('td', item.name), el('td', `₹${money(item.price)}`)); const actions = document.createElement('td'); actions.append(button('Remove', 'danger small', () => { cart.splice(i, 1); renderCart(); totals(); })); row.append(actions); body.append(row); }); }
function renderServices() { const q = $('searchService').value.toLowerCase(); const body = $('servicesTableBody'); body.replaceChildren(); state.services.forEach(service => { if (!service.name.toLowerCase().includes(q)) return; const row = document.createElement('tr'); row.append(el('td', service.name), el('td', `₹${money(service.price)}`)); const actions = document.createElement('td'); actions.append(button('Delete', 'danger small', async () => { if (!confirm(`Delete ${service.name}?`)) return; state.services = state.services.filter(x => x.id !== service.id); await save(); refreshServices(); })); row.append(actions); body.append(row); }); }
function refreshServices() { const select = $('serviceSelect'), current = select.value; select.replaceChildren(new Option('-- Choose Service --', '')); state.services.forEach(s => select.add(new Option(`${s.name} - ₹${money(s.price)}`, s.id))); select.value = current; renderServices(); }
function customerStats(phone) { const sales = state.sales.filter(s => s.customerPhone === phone); return { visits: sales.length, spent: sales.reduce((a,s) => a + s.total, 0), due: sales.reduce((a,s) => a + s.due, 0), lastVisit: sales.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.date || '' }; }
function renderCustomers() { const q = $('searchCust').value.toLowerCase(), body = $('customerTableBody'); body.replaceChildren(); Object.values(state.customers).filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(q)).sort((a,b) => a.name.localeCompare(b.name)).forEach(c => { const stats = customerStats(c.phone), row = document.createElement('tr'); [c.phone,c.name,c.email || '—',stats.visits,`₹${money(stats.spent)}`,`₹${money(stats.due)}`,stats.lastVisit ? dateDisplay(stats.lastVisit) : '—'].forEach(x => row.append(el('td', x))); body.append(row); }); }
function renderSales() { const body = $('salesTableBody'); body.replaceChildren(); [...state.sales].reverse().forEach(sale => { const row = document.createElement('tr'); [sale.id,dateDisplay(sale.date),sale.customerName,sale.customerPhone,sale.itemsDetail.map(x => x.name).join(', '),`₹${money(sale.total)}`,`₹${money(sale.paid)}`,`₹${money(sale.due)}`].forEach(x => row.append(el('td', x))); const actions = document.createElement('td'); actions.append(button('Print', 'small primary', () => printSale(sale)), button('WhatsApp', 'small whatsapp', () => shareSale(sale))); row.append(actions); body.append(row); }); }
function clearBill() { cart = []; manualPaidEdited = false; ['custPhone','custName','discount','paidAmount'].forEach((id) => $(id).value = id === 'discount' ? '0' : ''); $('taxRate').value = '18'; renderCart(); totals(); }

function createSale() {
  const phone = $('custPhone').value.trim(), name = $('custName').value.trim();
  if (!phone || !name) throw new Error('Please enter customer phone and name.');
  if (!cart.length) throw new Error('Cart is empty.');
  const t = totals(), now = new Date(), date = now.toISOString();
  state.customers[phone] = { phone, name, email: state.customers[phone]?.email || '' };
  const sale = { id: `INV-${Date.now().toString().slice(-8)}`, date, createdAt: date, fullDate: now.toLocaleString('en-IN'), customerPhone: phone, customerName: name, ...t, itemsDetail: cart.map(x => ({ name:x.name, price:x.price })) };
  state.sales.push(sale); return sale;
}
function fillReceipt(sale) { [['rInvoice',sale.id],['rDate',sale.fullDate || dateDisplay(sale.date)],['rName',sale.customerName],['rPhone',sale.customerPhone],['rSub',money(sale.subtotal)],['rTax',money(sale.taxAmount)],['rDisc',money(sale.discount)],['rTotal',money(sale.total)],['rPaid',money(sale.paid)],['rDue',money(sale.due)]].forEach(([id,value]) => $(id).textContent = value); const body = $('rItems'); body.replaceChildren(); sale.itemsDetail.forEach(i => { const row = document.createElement('tr'); row.append(el('td',i.name),el('td',`₹${money(i.price)}`)); body.append(row); }); }
function printSale(sale) { fillReceipt(sale); window.print(); }
function messageFor(sale) { return `✨ *MAKEOVER BY NITU SHARMA* ✨\n------------------------------------\nHello *${sale.customerName}*, thank you for visiting us!\n\n📄 *Invoice No:* #${sale.id}\n📅 *Date:* ${dateDisplay(sale.date)}\n\n💅 *Services Rendered:*\n${sale.itemsDetail.map((x,i) => `${i+1}. ${x.name} - ₹${money(x.price)}`).join('\n')}\n------------------------------------\n💵 *Subtotal:* ₹${money(sale.subtotal)}\nTax: ₹${money(sale.taxAmount)}\nDiscount: -₹${money(sale.discount)}\n*TOTAL: ₹${money(sale.total)}*\nPaid: ₹${money(sale.paid)}\nDue: ₹${money(sale.due)}\n\nThank you for visiting!`; }
async function shareSale(sale) { const phone = sale.customerPhone.replace(/\D/g,'').replace(/^(\d{10})$/, '91$1'), text = messageFor(sale), url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`; try { if (navigator.share) await navigator.share({ title:'Makeover POS invoice', text }); else if (window.makeoverDesktop) await window.makeoverDesktop.openExternal(url); else window.open(url, '_blank', 'noopener'); } catch (e) { if (e.name !== 'AbortError') alert('Could not open sharing: ' + e.message); } }
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function csvEscape(v) { const s=String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }
function exportCsv(name, rows) { download(name, rows.map(r => r.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8'); }

async function init() {
  db = await createDatabase(); state = await db.read(); $('storageStatus').textContent = `Stored locally: ${db.platform}`;
  document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('nav button,.tab').forEach(x => x.classList.remove('active')); b.classList.add('active'); $(b.dataset.tab).classList.add('active'); if (b.dataset.tab==='services') renderServices(); if (b.dataset.tab==='customers') renderCustomers(); if (b.dataset.tab==='sales') renderSales(); }));
  $('addItem').onclick = () => { const s=state.services.find(x=>x.id===$('serviceSelect').value); if (!s) return alert('Select a valid service.'); cart.push({name:s.name,price:s.price}); renderCart(); totals(); };
  $('saveService').onclick = async () => { const name=$('newServiceName').value.trim(), price=Number($('newServicePrice').value); if (!name || !Number.isFinite(price) || price<0) return alert('Enter a valid service name and price.'); if (state.services.some(s=>s.name.toLowerCase()===name.toLowerCase())) return alert('Service already exists.'); state.services.push({id:crypto.randomUUID(),name,price}); await save(); $('newServiceName').value=$('newServicePrice').value=''; refreshServices(); };
  $('custPhone').oninput = () => { const c=state.customers[$('custPhone').value.trim()]; if (c) $('custName').value=c.name; }; ['taxRate','discount'].forEach(id => $(id).oninput=()=>totals()); $('paidAmount').oninput=()=>totals(true); $('searchService').oninput=renderServices; $('searchCust').oninput=renderCustomers;
  $('saveCustomer').onclick = async () => { const phone=$('newCustPhone').value.trim(),name=$('newCustName').value.trim(),email=$('newCustEmail').value.trim(); if(!phone||!name)return alert('Enter customer name and phone.'); state.customers[phone]={...state.customers[phone],phone,name,email}; await save(); ['newCustPhone','newCustName','newCustEmail'].forEach(id=>$(id).value='');renderCustomers(); };
  $('savePrint').onclick = async () => { try { const s=createSale(); await save(); printSale(s); clearBill(); } catch(e) { alert(e.message); } }; $('saveShare').onclick = async () => { try { const s=createSale(); await save(); await shareSale(s); clearBill(); } catch(e) { alert(e.message); } };
  $('exportServices').onclick=()=>exportCsv('services.csv',[['Service Name','Price'],...state.services.map(x=>[x.name,x.price])]); $('exportCustomers').onclick=()=>exportCsv('customers.csv',[['Phone','Name','Email','Total Visits','Total Spent','Pending Dues','Last Visit'],...Object.values(state.customers).map(c=>{const x=customerStats(c.phone);return[c.phone,c.name,c.email,x.visits,x.spent,x.due,x.lastVisit];})]); $('exportSales').onclick=()=>exportCsv('sales.csv',[['Bill ID','Date','Customer','Phone','Services','Total','Paid','Due'],...state.sales.map(s=>[s.id,s.date,s.customerName,s.customerPhone,s.itemsDetail.map(i=>i.name).join('; '),s.total,s.paid,s.due])]);
  $('backupExport').onclick=async()=>download(`makeover-pos-backup-${new Date().toISOString().slice(0,10)}.json`,await db.exportBackup(),'application/json'); $('backupImport').onchange=async e=>{ const f=e.target.files[0]; if(!f)return; try{await db.restoreBackup(await f.text());state=await db.read();refreshServices();renderCustomers();renderSales();alert('Backup restored.');}catch(err){alert(err.message)}e.target.value=''; };
  refreshServices(); renderCart(); totals();
}
init().catch(e => { console.error(e); alert(`Could not open local data: ${e.message}`); });
