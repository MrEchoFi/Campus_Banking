import { invoke } from '@tauri-apps/api/core';
import './style.css';

type Screen = 'welcome' | 'pin' | 'menu' | 'balance' | 'withdraw' | 'deposit' | 'transfer' | 'statement' | 'change-pin' | 'dispense' | 'receipt';
type Session = { account_id: number; account_number: string; customer_name: string };
type Account = { account_number: string; customer_name: string; account_type: string; balance: number };
type Tx = { id: number; reference: string; transaction_type: string; amount: number; balance_after: number; description: string; created_at: string };
type AtmStatus = { notes: Record<string, number>; total_cash: number };

const app = document.querySelector<HTMLDivElement>('#app')!;
let screen: Screen = 'welcome';
let session: Session | null = null;
let account: Account | null = null;
let atm: AtmStatus | null = null;
let keypadValue = '';
let transferTarget = '';
let lastReceipt: Tx | null = null;
let lastMessage = '';
let changePinStage = 0;
let changePinValues = ['', '', ''];

const money = (v: number) => `৳${new Intl.NumberFormat('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]!));
const masked = (v: string) => v ? '•'.repeat(v.length) : '—';
const timeNow = () => new Date().toLocaleString('en-GB', { hour12: false });

async function loadAccount() {
  if (session) account = await invoke<Account>('get_account', { accountId: session.account_id });
}
async function loadAtm() {
  try { atm = await invoke<AtmStatus>('get_atm_status'); } catch { atm = null; }
}
async function getTransactions() {
  return session ? invoke<Tx[]>('get_transactions', { accountId: session.account_id }) : [];
}
function go(next: Screen) { screen = next; keypadValue = ''; transferTarget = ''; lastMessage = ''; render(); }
function logout() { session = null; account = null; atm = null; keypadValue = ''; transferTarget = ''; lastReceipt = null; lastMessage = ''; screen = 'welcome'; render(); }
function titleFor(s: Screen) {
  return ({ welcome:'WELCOME', pin:'ENTER PIN', menu:'MAIN MENU', balance:'BALANCE INQUIRY', withdraw:'CASH WITHDRAWAL', deposit:'CASH DEPOSIT', transfer:'TRANSFER FUNDS', statement:'MINI STATEMENT', receipt:'TRANSACTION COMPLETE' } as Record<Screen,string>)[s];
}
function screenText() {
  return ({
    welcome:'Please insert your virtual card to begin.', pin:'Enter your 4-digit personal identification number.', menu:'Select a service using the ATM keys.', balance:'Your current available account balance is shown below.', withdraw:'Choose an amount or enter a custom amount.', deposit:'Enter the amount of cash being deposited.', transfer:'Enter the destination account and transfer amount.', statement:'Your five most recent transactions are shown below.', receipt:'Please collect your receipt. Thank you for banking with CampusBank.'
  } as Record<Screen,string>)[screen];
}

function shell(content: string, leftLabels = ['','','',''], rightLabels = ['','','','']) {
  const name = account ? esc(account.customer_name) : 'CARD HOLDER';
  const accountNo = account ? `•••• ${account.account_number.slice(-4)}` : 'NOT INSERTED';
  return `
    <div class="terminal">
      <div class="terminal-top"><div class="bank-logo"><span class="logo-square">CB</span><div><strong>CAMPUSBANK</strong><small>SELF-SERVICE ATM</small></div></div><div class="terminal-meta"><span class="online-dot"></span> TERMINAL 01 <b>${timeNow()}</b></div></div>
      <div class="terminal-body">
        <section class="atm-bezel">
          <div class="screen-frame">
            <div class="screen-header"><span>${titleFor(screen)}</span><span>SECURE SESSION</span></div>
            <div class="screen-content">${content}</div>
            <div class="screen-footer"><span>CampusBank Demo • University Project</span><span>ESC = CANCEL</span></div>
          </div>
          <div class="bezel-lights"><i></i><i></i><i></i></div>
        </section>
        <section class="machine-controls">
          <div class="card-slot"><div class="slot-light"></div><div class="slot"></div><small>INSERT / REMOVE CARD</small></div>
          <div class="side-keys left">${leftLabels.map((x,i)=>`<button class="side-key" data-side="left" data-index="${i}" ${x?'':'disabled'}>${esc(x)}</button>`).join('')}</div>
          <div class="side-keys right">${rightLabels.map((x,i)=>`<button class="side-key" data-side="right" data-index="${i}" ${x?'':'disabled'}>${esc(x)}</button>`).join('')}</div>
          <div class="keypad-wrap">
            <div class="keypad-title">KEYPAD</div>
            <div class="keypad">
              ${['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(k=>`<button class="key ${k==='C'?'clear':''} ${k==='⌫'?'backspace':''}" data-key="${k}">${k}</button>`).join('')}
            </div>
            <div class="hardware-actions"><button id="cancel-btn" class="hardware cancel">CANCEL</button><button id="enter-btn" class="hardware enter">ENTER</button></div>
          </div>
          <div class="card-status"><div class="status-label">SESSION</div><strong>${name}</strong><span>${accountNo}</span><em>${session ? 'CARD INSERTED' : 'WAITING FOR CARD'}</em></div>
        </section>
      </div>
      <div class="terminal-bottom"><span>◉ CASH DISPENSER</span><span>▣ RECEIPT OUTLET</span><span>▰ PIN SHIELD ACTIVE</span><button id="logout-btn">EJECT CARD</button></div>
    </div>`;
}

function renderWelcome() {
  return shell(`<div class="welcome-screen"><div class="welcome-emblem">CB</div><p class="kicker">WELCOME TO</p><h1>CampusBank</h1><p class="welcome-sub">Secure self-service banking</p><div class="insert-card"><div class="card-chip"></div><div><strong>VIRTUAL DEBIT CARD</strong><span>UNIVERSITY ATM SIMULATOR</span></div></div><div class="account-number-entry"><span>ENTER ACCOUNT NUMBER</span><strong>${keypadValue || '—'}</strong><small>10 DIGITS • DEMO ACCOUNTS ONLY</small></div>${lastMessage?`<div class="message error">${esc(lastMessage)}</div>`:''}<p class="prompt">Enter the account number with the keypad, then press <b>ENTER</b></p><div class="demo-hint">Demo: <b>1002003001</b> / <b>1002003002</b></div><div class="info-strip"><span>24/7 SELF SERVICE</span><span>LOCAL SQLITE</span><span>RUST + TAURI</span></div></div>`, ['','','',''], ['','','','']);
}

function renderPin() {
  return shell(`<div class="pin-screen"><div class="user-greeting"><div class="avatar">${esc(session!.customer_name.slice(0,1))}</div><div><p>Welcome back</p><strong>${esc(session!.customer_name)}</strong><small>Account •••• ${session!.account_number.slice(-4)}</small></div></div><div class="pin-box"><span>ENTER YOUR PIN</span><strong>${masked(keypadValue)}</strong><small>4 DIGITS REQUIRED</small></div>${lastMessage ? `<div class="message error">${esc(lastMessage)}</div>` : ''}<p class="pin-help">Use the numeric keypad. Your PIN is never displayed.</p></div>`, ['','','',''], ['','','','']);
}

function renderMenu() {
  const items = [
    ['1','BALANCE INQUIRY','Check account balance','balance'],
    ['2','CASH WITHDRAWAL','Withdraw cash','withdraw'],
    ['3','CASH DEPOSIT','Deposit cash','deposit'],
    ['4','TRANSFER FUNDS','Send money to another account','transfer'],
    ['5','MINI STATEMENT','View recent transactions','statement'],
    ['6','CHANGE PIN','Update your PIN','pin-change'],
  ];
  const cards = items.map(([n,t,d,id])=>`<button class="service-card" data-service="${id}"><span class="service-number">${n}</span><div><strong>${t}</strong><small>${d}</small></div></button>`).join('');
  return shell(`<div class="menu-screen"><div class="menu-banner"><div><p>AVAILABLE BALANCE</p><strong>${money(account!.balance)}</strong></div><div class="mini-account">${esc(account!.account_type)}<br>•••• ${account!.account_number.slice(-4)}</div></div><div class="service-grid">${cards}</div><p class="menu-hint">Select a service on screen or press the corresponding keypad number.</p></div>`, ['','','',''], ['','','','']);
}

function renderBalance() {
  return shell(`<div class="result-screen"><div class="result-icon">৳</div><p class="kicker">AVAILABLE BALANCE</p><div class="big-money">${money(account!.balance)}</div><div class="account-details"><div><span>Account holder</span><strong>${esc(account!.customer_name)}</strong></div><div><span>Account type</span><strong>${esc(account!.account_type)}</strong></div><div><span>Account number</span><strong>•••• ${account!.account_number.slice(-4)}</strong></div></div>${lastMessage ? `<div class="message success">${esc(lastMessage)}</div>` : ''}<p class="prompt">Press <b>ENTER</b> to return to the main menu.</p></div>`, ['','','',''], ['','','','']);
}

function amountScreen(kind: 'withdraw'|'deposit') {
  const isWithdraw = kind === 'withdraw';
  const presets = isWithdraw ? [500,1000,2000,5000,10000,20000] : [500,1000,2000,5000,10000,20000];
  const status = isWithdraw ? (atm ? `<span>ATM CASH AVAILABLE ${money(atm.total_cash)}</span>` : '') : `<span>ACCOUNT BALANCE ${money(account!.balance)}</span>`;
  return shell(`<div class="amount-screen"><div class="amount-intro"><p class="kicker">${isWithdraw?'WITHDRAW CASH':'DEPOSIT CASH'}</p><div class="amount-display">${keypadValue ? money(Number(keypadValue)) : '<span>ENTER AMOUNT</span>'}</div>${status}</div><div class="preset-grid">${presets.map(v=>`<button class="preset" data-amount="${v}">${money(v)}</button>`).join('')}<button class="preset custom" data-amount="custom">CUSTOM</button></div>${lastMessage?`<div class="message error">${esc(lastMessage)}</div>`:''}<p class="prompt">Use the keypad or select a preset. Press <b>ENTER</b> to confirm.</p></div>`, ['','','',''], ['','','','']);
}

function renderTransfer() {
  const stage = transferTarget ? `<div class="transfer-stage"><div class="stage-box"><span>DESTINATION ACCOUNT</span><strong>${esc(transferTarget)}</strong></div><div class="stage-box"><span>TRANSFER AMOUNT</span><strong>${keypadValue ? money(Number(keypadValue)) : '—'}</strong></div></div>` : `<div class="account-entry"><p class="kicker">DESTINATION ACCOUNT</p><div class="entry-display">${keypadValue || '<span>ENTER ACCOUNT NUMBER</span>'}</div><small>10 DIGITS</small></div>`;
  return shell(`<div class="transfer-screen">${stage}${lastMessage?`<div class="message error">${esc(lastMessage)}</div>`:''}<p class="prompt">${transferTarget ? 'Enter transfer amount, then press ENTER.' : 'Enter the recipient account number, then press ENTER.'}</p></div>`, ['','','',''], ['','','','']);
}

async function renderStatement() {
  const tx = await getTransactions();
  const rows = tx.slice(0,5).map(t=>`<div class="statement-row"><span>${new Date(t.created_at).toLocaleDateString('en-GB')}</span><div><strong>${esc(t.description)}</strong><small>${t.reference.slice(0,10).toUpperCase()}</small></div><b class="${['DEPOSIT','TRANSFER_IN','OPENING'].includes(t.transaction_type)?'credit':'debit'}">${['DEPOSIT','TRANSFER_IN','OPENING'].includes(t.transaction_type)?'+':'-'}${money(t.amount)}</b></div>`).join('') || '<div class="empty-state">No transactions recorded.</div>';
  return shell(`<div class="statement-screen"><div class="statement-head"><div><p class="kicker">RECENT ACTIVITY</p><strong>MINI STATEMENT</strong></div><span>LAST 5</span></div><div class="statement-list">${rows}</div><p class="prompt">Press <b>ENTER</b> to return to the main menu.</p></div>`, ['','','',''], ['','','','']);
}

function renderChangePin() {
  const labels=['CURRENT PIN','NEW PIN','CONFIRM NEW PIN'];
  return shell(`<div class="pin-screen"><div class="pin-box"><span>${labels[changePinStage]}</span><strong>${masked(keypadValue)}</strong><small>4 DIGITS REQUIRED</small></div><div class="pin-steps">${labels.map((x,i)=>`<span class="${i===changePinStage?'active':''} ${i<changePinStage?'done':''}">${i+1}</span><b>${x}</b>`).join('')}</div>${lastMessage?`<div class="message error">${esc(lastMessage)}</div>`:''}<p class="prompt">Press <b>ENTER</b> after each PIN entry.</p></div>`, ['','','',''], ['','','','']);
}

function renderDispense() {
  const amount = lastReceipt?.amount ?? 0;
  return shell(`<div class="dispense-screen"><div class="cash-icon">৳</div><p class="kicker">CASH DISPENSER</p><h2>${money(amount)}</h2><div class="dispense-animation"><div class="cash-slot"></div><div class="cash-bundle"><i></i><i></i><i></i></div></div><strong>PLEASE TAKE YOUR CASH</strong><small>Do not forget your card and receipt.</small></div>`, ['','','',''], ['','','','']);
}

function renderReceipt() {
  const tx = lastReceipt;
  return shell(`<div class="receipt-screen"><div class="receipt-paper"><div class="receipt-logo">CAMPUSBANK</div><small>SELF-SERVICE ATM • TERMINAL 01</small><hr><div><span>DATE</span><b>${tx ? new Date(tx.created_at).toLocaleString('en-GB') : timeNow()}</b></div>${tx?`<div><span>TRANSACTION</span><b>${esc(tx.transaction_type.replace('_',' '))}</b></div><div><span>REFERENCE</span><b>${esc(tx.reference.slice(0,16).toUpperCase())}</b></div><div><span>AMOUNT</span><b>${money(tx.amount)}</b></div><div><span>BALANCE</span><b>${money(tx.balance_after)}</b></div><hr><div><span>ACCOUNT</span><b>•••• ${session!.account_number.slice(-4)}</b></div>`:''}<hr><strong class="receipt-thanks">THANK YOU FOR BANKING WITH US</strong></div><p class="prompt">Press <b>ENTER</b> to return to the main menu or eject the card.</p></div>`, ['','','',''], ['','','','']);
}

async function render() {
  if (screen === 'welcome') { app.innerHTML = renderWelcome(); bind(); return; }
  if (!session || !account) { screen='welcome'; app.innerHTML = renderWelcome(); bind(); return; }
  if (screen === 'pin') { app.innerHTML = renderPin(); bind(); return; }
  if (screen === 'menu') { app.innerHTML = renderMenu(); bind(); return; }
  if (screen === 'balance') { app.innerHTML = renderBalance(); bind(); return; }
  if (screen === 'withdraw' || screen === 'deposit') { app.innerHTML = amountScreen(screen); bind(); return; }
  if (screen === 'transfer') { app.innerHTML = renderTransfer(); bind(); return; }
  if (screen === 'statement') { app.innerHTML = await renderStatement(); bind(); return; }
  if (screen === 'change-pin') { app.innerHTML = renderChangePin(); bind(); return; }
  if (screen === 'dispense') { app.innerHTML = renderDispense(); bind(); return; }
  if (screen === 'receipt') { app.innerHTML = renderReceipt(); bind(); return; }
}

function bind() {
  document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b => b.onclick = () => pressKey(b.dataset.key!));
  document.querySelectorAll<HTMLButtonElement>('[data-amount]').forEach(b => b.onclick = () => {
    const v=b.dataset.amount!;
    if(v==='custom'){keypadValue='';render();return;}
    keypadValue=v;render();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-service]').forEach(b => b.onclick = () => selectService(b.dataset.service!));
  document.querySelector<HTMLButtonElement>('#enter-btn')!.onclick = enterAction;
  document.querySelector<HTMLButtonElement>('#cancel-btn')!.onclick = cancelAction;
  document.querySelector<HTMLButtonElement>('#logout-btn')!.onclick = logout;
  window.onkeydown = (e) => {
    if (/^[0-9]$/.test(e.key)) pressKey(e.key);
    else if (e.key==='Enter') enterAction();
    else if (e.key==='Escape') cancelAction();
    else if (e.key==='Backspace') pressKey('⌫');
    else if (e.key.toUpperCase()==='C') pressKey('C');
  };
}

function pressKey(k: string) {
  if (k==='C') { keypadValue=''; render(); return; }
  if (k==='⌫') { keypadValue=keypadValue.slice(0,-1); render(); return; }
  const max = ['pin','change-pin'].includes(screen) ? 4 : (screen==='welcome' || (screen==='transfer' && !transferTarget)) ? 10 : 8;
  if (keypadValue.length < max) keypadValue += k;
  render();
}

async function enterAction() {
  if(screen==='welcome') {
    if(keypadValue.length!==10){ lastMessage='Enter a valid 10-digit demo account number.'; render(); return; }
    try {
      session = await invoke<Session>('begin_card_session', { accountNumber: keypadValue });
      await loadAccount(); await loadAtm(); keypadValue=''; lastMessage=''; screen='pin'; render();
    } catch(err) { lastMessage=String(err); keypadValue=''; render(); }
    return;
  }
  if(screen==='pin') {
    if(keypadValue.length!==4) { lastMessage='PIN must contain exactly 4 digits.'; render(); return; }
    try { await invoke('verify_pin', { accountId: session!.account_id, pin: keypadValue }); keypadValue=''; screen='menu'; render(); }
    catch(err) { keypadValue=''; lastMessage=String(err); render(); }
    return;
  }
  if(screen==='menu') return;
  if(screen==='balance' || screen==='statement') { go('menu'); return; }
  if(screen==='withdraw' || screen==='deposit') {
    const amount=Number(keypadValue); if(!Number.isFinite(amount)||amount<=0){lastMessage='Enter a valid amount.';render();return;}
    try {
      lastReceipt = screen==='withdraw' ? await invoke<Tx>('withdraw', { accountId: session!.account_id, amount }) : await invoke<Tx>('deposit', { accountId: session!.account_id, amount });
      await loadAccount(); await loadAtm(); keypadValue=''; screen = screen==='withdraw' ? 'dispense' : 'receipt'; render();
      if(screen==='dispense') window.setTimeout(()=>{screen='receipt';render();}, 1600);
    } catch(err){lastMessage=String(err);render();}
    return;
  }
  if(screen==='transfer') {
    if(!transferTarget) { if(keypadValue.length!==10){lastMessage='Recipient account must be 10 digits.';render();return;} transferTarget=keypadValue; keypadValue=''; render(); return; }
    const amount=Number(keypadValue); if(!Number.isFinite(amount)||amount<=0){lastMessage='Enter a valid transfer amount.';render();return;}
    try { lastReceipt=await invoke<Tx>('transfer', { fromId: session!.account_id, toAccountNumber: transferTarget, amount }); await loadAccount(); screen='receipt'; keypadValue=''; transferTarget=''; render(); }
    catch(err){lastMessage=String(err);render();}
    return;
  }
  if(screen==='change-pin') {
    if(keypadValue.length!==4){ lastMessage='PIN must contain exactly 4 digits.'; render(); return; }
    changePinValues[changePinStage]=keypadValue; keypadValue=''; lastMessage='';
    if(changePinStage<2){ changePinStage++; render(); return; }
    if(changePinValues[1]!==changePinValues[2]){ changePinStage=2; lastMessage='New PIN and confirmation do not match.'; render(); return; }
    try { await invoke('change_pin',{accountId:session!.account_id,currentPin:changePinValues[0],newPin:changePinValues[1]}); changePinStage=0; changePinValues=['','','']; lastMessage='PIN changed successfully.'; go('menu'); }
    catch(err){ changePinStage=0; changePinValues=['','','']; lastMessage=String(err); render(); }
    return;
  }
  if(screen==='receipt') { go('menu'); }
}

function cancelAction() {
  if(screen==='welcome') return;
  if(screen==='pin') { logout(); return; }
  if(screen==='menu') { logout(); return; }
  if(screen==='receipt') { logout(); return; }
  if(screen==='dispense') { logout(); return; }
  if(screen==='change-pin') { changePinStage=0; changePinValues=['','','']; go('menu'); return; }
  go('menu');
}

function selectService(id: string) {
  if(id==='balance') go('balance');
  else if(id==='withdraw') go('withdraw');
  else if(id==='deposit') go('deposit');
  else if(id==='transfer') go('transfer');
  else if(id==='statement') go('statement');
  else if(id==='pin-change') { changePinStage=0; changePinValues=['','','']; go('change-pin'); }
}

render();
