// ==================== MÓDULO LÍDER DE RESTAURANTE ====================
// HUO06, HUO07, HUO08

// HUO06: Listar todas las reservas
async function renderGestionReservas() {
    setPageTitle('Gestión de Reservas', 'fa-list-alt');
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-filter"></i> Filtros</h3>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Estado</label>
                    <select id="filtro-estado" onchange="cargarReservas()">
                        <option value="">Todos</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="confirmada">Confirmada</option>
                        <option value="cancelada">Cancelada</option>
                        <option value="pagada">Pagada</option>
                        <option value="rechazada">Rechazada</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-calendar-alt"></i> Lista de Reservas</h3>
                <span class="badge badge-pendiente" id="total-reservas">Cargando...</span>
            </div>
            <div class="table-container" id="tabla-reservas">${showLoader()}</div>
        </div>`;
    cargarReservas();
}

async function cargarReservas() {
    const estado = document.getElementById('filtro-estado').value;
    const container = document.getElementById('tabla-reservas');
    container.innerHTML = showLoader();
    
    try {
        let url = '/reservas';
        if (estado) url += `?estado=${estado}`;
        const reservas = await fetchAPI(url);
        
        document.getElementById('total-reservas').textContent = `${reservas.length} reservas`;
        
        if (reservas.length === 0) {
            container.innerHTML = '<p class="text-center" style="padding: 40px; color: #666;">No hay reservas registradas</p>';
            return;
        }
        
        container.innerHTML = `
            <table>
                <thead><tr><th>ID</th><th>Fecha/Hora</th><th>Cliente</th><th>DNI</th><th>Teléfono</th><th>Mesa</th><th>Pers.</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${reservas.map(r => `
                        <tr>
                            <td><strong>#${r.id}</strong></td>
                            <td>${r.fecha} ${r.hora}</td>
                            <td>${r.cliente}</td>
                            <td>${r.dni}</td>
                            <td>${r.telefono || '-'}</td>
                            <td>Mesa ${r.mesa}</td>
                            <td>${r.personas}</td>
                            <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
                            <td>
                                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                                    ${r.estado === 'pendiente' ? `
                                        <button class="btn btn-success btn-sm" onclick="cambiarEstadoReserva(${r.id}, 'confirmada')" title="Confirmar"><i class="fas fa-check"></i></button>
                                        <button class="btn btn-danger btn-sm" onclick="cambiarEstadoReserva(${r.id}, 'rechazada')" title="Rechazar"><i class="fas fa-times"></i></button>
                                    ` : ''}
                                    ${['pendiente', 'confirmada'].includes(r.estado) ? `
                                        <button class="btn btn-info btn-sm" onclick="editarReservaLider(${r.id})" title="Editar"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-warning btn-sm" onclick="cambiarEstadoReserva(${r.id}, 'cancelada')" title="Cancelar"><i class="fas fa-ban"></i></button>
                                    ` : ''}
                                    ${['cancelada', 'rechazada'].includes(r.estado) ? `
                                        <button class="btn btn-danger btn-sm" onclick="eliminarReserva(${r.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    } catch (e) {
        container.innerHTML = '<p class="text-center" style="color: var(--danger);">Error al cargar reservas</p>';
    }
}

// HUO07: Modificar reservas
async function editarReservaLider(id) {
    try {
        const reserva = await fetchAPI(`/reservas/${id}`);
        const mesas = await fetchAPI('/mesas');
        
        const bodyHtml = `
            <div class="form-group">
                <label><i class="fas fa-calendar"></i> Fecha</label>
                <input type="date" id="edit-fecha" value="${reserva.fecha}">
            </div>
            <div class="form-group">
                <label><i class="fas fa-clock"></i> Hora</label>
                <input type="time" id="edit-hora" value="${reserva.hora}">
            </div>
            <div class="form-group">
                <label><i class="fas fa-users"></i> Cantidad de Personas</label>
                <input type="number" id="edit-cantidad" value="${reserva.cantidad}" min="1">
            </div>
            <div class="form-group">
                <label><i class="fas fa-chair"></i> Mesa</label>
                <select id="edit-mesa">
                    ${mesas.map(m => `<option value="${m.id}" ${m.id == reserva.id_mesa ? 'selected' : ''}>Mesa ${m.numero} - ${m.tipo} (${m.capacidad} pers.)</option>`).join('')}
                </select>
            </div>
            <hr style="margin: 20px 0;">
            <h4><i class="fas fa-user"></i> Datos del Cliente</h4>
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="edit-nombre" value="${reserva.cliente?.nombre || ''}">
            </div>
            <div class="form-group">
                <label>Apellido</label>
                <input type="text" id="edit-apellido" value="${reserva.cliente?.apellido || ''}">
            </div>
            <div class="form-group">
                <label>Teléfono</label>
                <input type="tel" id="edit-telefono" value="${reserva.cliente?.telefono || ''}">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="edit-email" value="${reserva.cliente?.email || ''}">
            </div>`;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancelar</button>
            <button class="btn btn-success" onclick="guardarEdicionReservaLider(${id})"><i class="fas fa-save"></i> Guardar Cambios</button>`;
        
        openModal(`Editar Reserva #${id}`, bodyHtml, footerHtml);
    } catch (e) {}
}

async function guardarEdicionReservaLider(id) {
    const data = {
        fecha: document.getElementById('edit-fecha').value,
        hora: document.getElementById('edit-hora').value,
        cantidad: parseInt(document.getElementById('edit-cantidad').value),
        id_mesa: document.getElementById('edit-mesa').value,
        cliente: {
            nombre: document.getElementById('edit-nombre').value,
            apellido: document.getElementById('edit-apellido').value,
            telefono: document.getElementById('edit-telefono').value,
            email: document.getElementById('edit-email').value
        }
    };
    
    try {
        await fetchAPI(`/reservas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        showToast('Reserva actualizada correctamente', 'success');
        closeModal();
        cargarReservas();
    } catch (e) {}
}

function cambiarEstadoReserva(id, nuevoEstado) {
    const mensajes = {
        'confirmada': '¿Confirmar esta reserva?',
        'rechazada': '¿Rechazar esta reserva?',
        'cancelada': '¿Cancelar esta reserva?'
    };
    const iconos = {
        'confirmada': ['fa-check-circle', 'var(--success)'],
        'rechazada': ['fa-times-circle', 'var(--danger)'],
        'cancelada': ['fa-ban', 'var(--warning)']
    };
    
    showConfirm('Cambiar Estado', mensajes[nuevoEstado], async () => {
        try {
            await fetchAPI(`/reservas/${id}`, { method: 'PUT', body: JSON.stringify({ estado: nuevoEstado }) });
            showToast(`Reserva ${nuevoEstado} correctamente`, 'success');
            cargarReservas();
        } catch (e) {}
    }, iconos[nuevoEstado][0], iconos[nuevoEstado][1]);
}

// HUO08: Eliminar reservas canceladas
function eliminarReserva(id) {
    showConfirm('Eliminar Reserva', '¿Está seguro de eliminar permanentemente esta reserva? Esta acción no se puede deshacer.', async () => {
        try {
            await fetchAPI(`/reservas/${id}`, { method: 'DELETE' });
            showToast('Reserva eliminada correctamente', 'success');
            cargarReservas();
        } catch (e) {}
    }, 'fa-trash-alt', 'var(--danger)');
}

// Administración
function renderAdmin() {
    setPageTitle('Administración', 'fa-cog');
    const content = document.getElementById('content-area');
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-database"></i> Base de Datos</h3>
            </div>
            <p style="margin-bottom: 20px; color: #666;">Esta acción eliminará todos los datos actuales y creará datos de prueba nuevos.</p>
            <button class="btn btn-warning" onclick="resetearBD()">
                <i class="fas fa-sync-alt"></i> Resetear y Poblar Base de Datos
            </button>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-info-circle"></i> Información del Sistema</h3>
            </div>
            <table>
                <tr><td><strong>Sistema</strong></td><td>Pardos Chicken - Gestión Integral</td></tr>
                <tr><td><strong>Versión</strong></td><td>2.0.0</td></tr>
                <tr><td><strong>Usuario Actual</strong></td><td>${CURRENT_USER} (${CURRENT_ROLE})</td></tr>
            </table>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-book"></i> Historias de Usuario Implementadas</h3>
            </div>
            <table>
                <thead><tr><th>Código</th><th>Descripción</th><th>Rol</th></tr></thead>
                <tbody>
                    <tr><td>HUO01</td><td>Consultar disponibilidad de mesas</td><td>Anfitriona</td></tr>
                    <tr><td>HUO02</td><td>Ver todas las mesas disponibles</td><td>Anfitriona</td></tr>
                    <tr><td>HUO03</td><td>Registrar nueva reserva</td><td>Anfitriona</td></tr>
                    <tr><td>HUO04</td><td>Modificar datos de reserva</td><td>Anfitriona</td></tr>
                    <tr><td>HUO05</td><td>Enviar solicitud de reserva a cajera</td><td>Anfitriona</td></tr>
                    <tr><td>HUO06</td><td>Listar todas las reservas</td><td>Líder</td></tr>
                    <tr><td>HUO07</td><td>Modificar detalles de reserva</td><td>Líder</td></tr>
                    <tr><td>HUO08</td><td>Eliminar reservas canceladas</td><td>Líder</td></tr>
                    <tr><td>HUO09</td><td>Generar comanda con múltiples platos</td><td>Anfitrión/Mozo</td></tr>
                    <tr><td>HUO10</td><td>Modificar comanda</td><td>Anfitrión/Mozo</td></tr>
                    <tr><td>HUO11</td><td>Recibir y completar comandas</td><td>Maestro Brasa</td></tr>
                    <tr><td>HUO12</td><td>Registrar pago y cambiar estado</td><td>Cajera</td></tr>
                    <tr><td>HUO13</td><td>Generar comprobante de pago</td><td>Cajera</td></tr>
                    <tr><td>HUO14</td><td>Modificar pedido antes de pagar</td><td>Cajera</td></tr>
                </tbody>
            </table>
        </div>`;
}

function resetearBD() {
    showConfirm('Resetear Base de Datos', '¿Está seguro? Se eliminarán TODOS los datos y se crearán datos de prueba.', async () => {
        try {
            showToast('Procesando...', 'info');
            const res = await fetchAPI('/admin/seed', { method: 'POST' });
            showToast(res.message, 'success');
        } catch (e) {}
    }, 'fa-exclamation-triangle', 'var(--danger)');
}