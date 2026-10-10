const SUPABASE_URL = 'https://vsaldxqblzzlzrpriucv.supabase.co';
const SUPABASE_ANON_KEY = 'Sb_publishable_tqfbQDrGawItFonb8NnWVQ_aGM50Xzt';

const appUrl = (() => {
    const pathname = window.location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '');
    return `${window.location.origin}${pathname}/`;
})();

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function notify(message, type = 'info') {
    let bg = '#1E5F2D';
    if (type === 'error') bg = '#DC2626';
    if (type === 'warning') bg = '#D97706';

    Toastify({
        text: message,
        duration: 4000,
        gravity: 'top',
        position: 'right',
        style: { background: bg, borderRadius: '12px', fontSize: '14px', fontWeight: '600' }
    }).showToast();
}

function formatCedulaInput(input) {
    let val = input.value.replace(/\D/g, '');
    if (val.length > 3 && val.length <= 10) {
        val = val.substring(0, 3) + '-' + val.substring(3);
    } else if (val.length > 10) {
        val = val.substring(0, 3) + '-' + val.substring(3, 10) + '-' + val.substring(10, 11);
    }
    input.value = val;
}

function ensureSupabase() {
    if (!window.supabase || !supabase) {
        notify('Supabase no está disponible en este momento. Verifica tu conexión.', 'error');
        return false;
    }
    return true;
}

async function signInWithSocial(provider) {
    if (!ensureSupabase()) return;

    const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: appUrl }
    });

    if (error) {
        notify('Error al conectar con ' + provider + ': ' + error.message, 'error');
    }
}

let audioContext = null;

function getAudioContext() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;

    if (!audioContext) {
        audioContext = new AudioCtor();
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    return audioContext;
}

function playBillSound() {
    try {
        const audioCtx = getAudioContext();
        if (!audioCtx) return;

        const bufferSize = audioCtx.sampleRate * 0.04;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25)) * 0.12;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1200;

        noise.connect(filter);
        filter.connect(audioCtx.destination);
        noise.start();
    } catch (error) {
        console.warn('No se pudo reproducir el audio del rebote:', error);
    }
}

const logoImg = new Image();
logoImg.src = 'logo.png.JPG';
logoImg.onerror = function () {
    logoImg.src = 'logo.png';
};

const canvas = document.getElementById('fyeCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let ball = { x: 120, y: 100, dx: 3.2, dy: 2.6, radius: 45 };

function animateBall() {
    if (!canvas || !ctx || canvas.width === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ball.x += ball.dx;
    ball.y += ball.dy;

    let bounced = false;
    if (ball.x - ball.radius <= 0) { ball.x = ball.radius; ball.dx = -ball.dx; bounced = true; }
    else if (ball.x + ball.radius >= canvas.width) { ball.x = canvas.width - ball.radius; ball.dx = -ball.dx; bounced = true; }
    if (ball.y - ball.radius <= 0) { ball.y = ball.radius; ball.dy = -ball.dy; bounced = true; }
    else if (ball.y + ball.radius >= canvas.height) { ball.y = canvas.height - ball.radius; ball.dy = -ball.dy; bounced = true; }

    if (bounced) {
        playBillSound();
        ball.dx += (Math.random() - 0.5) * 0.5;
        ball.dy += (Math.random() - 0.5) * 0.5;
        const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        if (speed < 2.8) { ball.dx *= 1.2; ball.dy *= 1.2; }
        if (speed > 6.5) { ball.dx *= 0.8; ball.dy *= 0.8; }
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    if (logoImg.complete && logoImg.naturalWidth !== 0) {
        ctx.drawImage(logoImg, ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2);
    } else {
        ctx.fillStyle = '#1E5F2D';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('F&E', ball.x, ball.y);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2, true);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#FFB823';
    ctx.stroke();
    ctx.closePath();

    requestAnimationFrame(animateBall);
}

if (canvas && ctx) {
    requestAnimationFrame(animateBall);
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const icon = document.getElementById('menu-icon');
    if (!menu || !icon) return;

    menu.classList.toggle('hidden');
    icon.className = menu.classList.contains('hidden') ? 'fa-solid fa-bars text-xl' : 'fa-solid fa-xmark text-xl';
}

function switchTab(tab) {
    const tabs = ['login', 'registro'];
    tabs.forEach((name) => {
        const tabElement = document.getElementById('tab-' + name);
        if (tabElement) tabElement.classList.add('hidden');
    });

    const target = document.getElementById('tab-' + tab);
    if (target) target.classList.remove('hidden');
}

function showSection(section) {
    const sections = ['inicio', 'quienes-somos'];
    sections.forEach((name) => {
        const element = document.getElementById('section-' + name);
        if (element) element.classList.add('hidden');
    });

    const target = document.getElementById('section-' + section);
    if (target) target.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleLogin(event) {
    event.preventDefault();
    if (!ensureSupabase()) return;

    const email = document.getElementById('login-correo').value.trim();
    const password = document.getElementById('login-password').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        notify('Error al iniciar sesión: ' + error.message, 'error');
    } else {
        notify('¡Inicio de sesión exitoso! Bienvenido a INVERSIONES F Y E.');
    }
}

function validarCedulaDominicana(cedula) {
    const limpia = String(cedula || '').replace(/-/g, '').trim();
    if (limpia.length !== 11 || isNaN(limpia)) return false;

    let suma = 0;
    const peso = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];

    for (let i = 0; i < 10; i++) {
        const mult = parseInt(limpia.charAt(i), 10) * peso[i];
        suma += (mult >= 10) ? Math.floor(mult / 10) + (mult % 10) : mult;
    }

    const digitoVerificador = (10 - (suma % 10)) % 10;
    return digitoVerificador === parseInt(limpia.charAt(10), 10);
}

async function handleRegister(event) {
    event.preventDefault();
    if (!ensureSupabase()) return;

    const nombre = document.getElementById('reg-nombre').value.trim();
    const cedula = document.getElementById('reg-cedula').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const montoValue = document.getElementById('reg-monto').value;
    const moneda = document.getElementById('reg-moneda').value;
    const correo = document.getElementById('reg-correo').value.trim();
    const password = document.getElementById('reg-password').value;
    const contratoAceptado = document.getElementById('reg-contrato').checked;

    if (!validarCedulaDominicana(cedula)) {
        notify('⚠️ Error: La cédula introducida no es válida.', 'error');
        return;
    }
    if (!contratoAceptado) {
        notify('⚠️ Debe aceptar el contrato de cumplimiento y prevención de lavado de activos.', 'warning');
        return;
    }

    const monto = Number(montoValue);
    if (!Number.isFinite(monto) || monto <= 0) {
        notify('Ingresa un monto válido para abrir la cuenta.', 'error');
        return;
    }

    if (moneda === 'DOP') {
        if (monto < 2000) {
            notify('⚠️ Error: El monto mínimo de apertura para certificados es de RD$2,000.', 'error');
            return;
        }
        if (monto > 50000) {
            notify('⚠️ Error: El monto máximo de depósito en línea es de RD$50,000.', 'error');
            return;
        }
    } else if (moneda === 'USD') {
        if (monto > 1000) {
            notify('⚠️ Error: El depósito máximo en dólares es de $1,000 USD.', 'error');
            return;
        }
    }

    const { data, error } = await supabase.auth.signUp({
        email: correo,
        password,
        options: {
            data: { nombre, cedula, telefono, monto, moneda }
        }
    });

    if (error) {
        notify('Error en el registro: ' + error.message, 'error');
        return;
    }

    if (data?.user) {
        notify('¡Cuenta creada exitosamente! Revisa tu correo para confirmar la cuenta.');
        switchTab('login');
        document.getElementById('login-correo').value = correo;
    } else {
        notify('Se ha enviado la solicitud de registro. Revisa tu correo para continuar.');
    }
}
