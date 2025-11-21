// ==================== CONFIGURACIÓN GLOBAL ====================
const API = '/api';
let CURRENT_ROLE = '';
let CURRENT_USER = '';

// ==================== UTILIDADES ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { 
        success: 'fa-check-circle', 
        error: 'fa-exclamation-circle', 
        warning: 'fa-exclamation-triangle', 
        info: 'fa-info-circle' 
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function showConfirm(title, message, callback, icon = 'fa-question-circle', iconColor = 'var(--warning)') {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-icon').className = `fas ${icon}`;
    document.getElementById('confirm-icon').style.color = iconColor;
    document.getElementById('confirm-btn').onclick = () => { closeConfirm(); callback(); };
    document.getElementById('confirm-overlay').classList.add('active');
}

function closeConfirm() { 
    document.getElementById('confirm-overlay').classList.remove('active'); 
}

function openModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() { 
    document.getElementById('modal-overlay').classList.remove('active'); 
}

function setPageTitle(title, icon) {
    document.getElementById('page-title').innerHTML = `<i class="fas ${icon}"></i> ${title}`;
}

function showLoader() { 
    return '<div class="loader"><div class="spinner"></div></div>'; 
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const res = await fetch(`${API}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error en la petición');
        return data;
    } catch (e) {
        showToast(e.message, 'error');
        throw e;
    }
}

// ==================== AUTENTICACIÓN ====================
async function login() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;
    if (!user || !pass) return showToast('Complete todos los campos', 'warning');
    
    try {
        const data = await fetchAPI('/login', {
            method: 'POST',
            body: JSON.stringify({ username: user, password: pass })
        });
        if (data.success) {
            CURRENT_ROLE = data.role;
            CURRENT_USER = data.username;
            document.getElementById('user-name').textContent = `${data.username} (${data.role})`;
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('app-view').classList.remove('hidden');
            document.getElementById('app-view').style.display = 'block';
            buildMenu();
            showToast(`Bienvenido, ${data.username}!`, 'success');
        }
    } catch (e) {}
}

function logout() {
    showConfirm('Cerrar Sesión', '¿Está seguro que desea salir del sistema?', async () => {
        await fetchAPI('/logout', { method: 'POST' });
        location.reload();
    }, 'fa-sign-out-alt', 'var(--danger)');
}

// ==================== MENÚ DINÁMICO ====================
function buildMenu() {
    const menu = document.getElementById('sidebar-menu');
    menu.innerHTML = '';
    
    const menuItems = [
        { 
            roles: ['Anfitriona de Bienvenida'], 
            items: [
                { icon: 'fa-calendar-check', label: 'Disponibilidad', action: renderDisponibilidad, codes: 'HUO01, HUO02' },
                { icon: 'fa-plus-circle', label: 'Nueva Reserva', action: renderNuevaReserva, codes: 'HUO03, HUO05' },
                { icon: 'fa-edit', label: 'Modificar Reserva', action: renderModificarReserva, codes: 'HUO04' },
                { icon: 'fa-utensils', label: 'Tomar Pedido', action: renderAnfitrionaTomaPedido, codes: 'Extra' }
            ]
        },
        { 
            roles: ['Líder de Restaurante'], 
            items: [
                { icon: 'fa-list-alt', label: 'Gestión Reservas', action: renderGestionReservas, codes: 'HUO06, HUO07, HUO08' },
                { icon: 'fa-cog', label: 'Administración', action: renderAdmin, codes: 'Admin' }
            ]
        },
        { 
            roles: ['Anfitrión de Servicio'], 
            items: [
                { icon: 'fa-utensils', label: 'Tomar Pedido', action: renderTomarPedido, codes: 'HUO09' },
                { icon: 'fa-edit', label: 'Modificar Comanda', action: renderModificarComanda, codes: 'HUO10' },
                { icon: 'fa-fire', label: 'Ver Cocina', action: renderCocina, codes: 'HUO11' }
            ]
        },
        { 
            roles: ['Maestro Brasa'], 
            items: [
                { icon: 'fa-fire-alt', label: 'Cocina', action: renderCocina, codes: 'HUO11' }
            ]
        },
        { 
            roles: ['Cajera'], 
            items: [
                { icon: 'fa-cash-register', label: 'Caja / Pagos', action: renderCaja, codes: 'HUO12, HUO13, HUO14' }
            ]
        }
    ];

    menuItems.forEach(section => {
        if (section.roles.includes(CURRENT_ROLE)) {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'menu-section';
            section.items.forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'menu-btn';
                btn.innerHTML = `<i class="fas ${item.icon}"></i><span>${item.label}</span>`;
                btn.title = item.codes;
                btn.onclick = () => {
                    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    item.action();
                };
                sectionDiv.appendChild(btn);
            });
            menu.appendChild(sectionDiv);
        }
    });
    
    // Auto-click primer botón
    if (menu.firstChild?.firstChild) {
        menu.firstChild.firstChild.click();
    }
}

// ==================== API DNI ====================
async function consultarDNI(dni) {
    if (dni.length !== 8) return;
    try {
        const data = await fetchAPI(`/consulta-dni/${dni}`);
        if (data.success) {
            document.getElementById('input-nombre').value = data.nombres || data.nombre?.split(' ')[0] || '';
            document.getElementById('input-apellido').value = data.apellido_paterno ? 
                `${data.apellido_paterno} ${data.apellido_materno || ''}`.trim() : 
                data.nombre?.split(' ').slice(1).join(' ') || '';
            if (data.telefono) document.getElementById('input-telefono').value = data.telefono;
            if (data.email) document.getElementById('input-email').value = data.email;
            showToast(data.local ? 'Cliente encontrado en sistema' : 'Datos obtenidos de RENIEC', 'success');
        }
    } catch (e) {
        showToast('No se encontró información del DNI', 'warning');
    }
}

// ==================== ENTER PARA LOGIN ====================
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !document.getElementById('login-view').classList.contains('hidden')) {
        login();
    }
});

// ==================== VERIFICAR SESIÓN AL CARGAR ====================
window.addEventListener('load', async () => {
    try {
        const session = await fetchAPI('/session');
        if (session.logged_in) {
            CURRENT_ROLE = session.role;
            CURRENT_USER = session.username;
            document.getElementById('user-name').textContent = `${session.username} (${session.role})`;
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('app-view').classList.remove('hidden');
            document.getElementById('app-view').style.display = 'block';
            buildMenu();
        }
    } catch (e) {
        // No hay sesión activa
    }
});