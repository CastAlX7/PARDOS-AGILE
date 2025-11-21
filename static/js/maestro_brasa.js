// ==================== MÓDULO MAESTRO BRASA (COCINERO) ====================
// HUO11

// HUO11: Recibir y completar comandas
async function renderCocina() {
    setPageTitle('Cocina - Comandas', 'fa-fire-alt');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const comandas = await fetchAPI('/comandas');
        const activas = comandas.filter(c => ['pendiente', 'completada'].includes(c.estado));
        
        if (activas.length === 0) {
            content.innerHTML = `
                <div class="card text-center" style="padding: 60px;">
                    <i class="fas fa-check-double" style="font-size: 4em; color: var(--success);"></i>
                    <h3 style="margin-top: 20px; color: var(--success);">¡Todo al día!</h3>
                    <p style="color: #666;">No hay comandas pendientes en este momento</p>
                    <button class="btn btn-primary mt-3" onclick="renderCocina()">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                </div>`;
            return;
        }
        
        const pendientes = activas.filter(c => c.estado === 'pendiente');
        const completadas = activas.filter(c => c.estado === 'completada');
        
        content.innerHTML = `
            <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                <div class="card" style="flex: 1; text-align: center; padding: 20px; background: linear-gradient(135deg, #fff3cd, #ffeeba);">
                    <h2 style="font-size: 2.5em; color: #856404;">${pendientes.length}</h2>
                    <p style="color: #856404; font-weight: 600;"><i class="fas fa-clock"></i> Pendientes</p>
                </div>
                <div class="card" style="flex: 1; text-align: center; padding: 20px; background: linear-gradient(135deg, #d4edda, #c3e6cb);">
                    <h2 style="font-size: 2.5em; color: #155724;">${completadas.length}</h2>
                    <p style="color: #155724; font-weight: 600;"><i class="fas fa-check"></i> Listas para Servir</p>
                </div>
                <div class="card" style="flex: 0.5; text-align: center; padding: 20px;">
                    <button class="btn btn-info" onclick="renderCocina()" title="Actualizar">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
            </div>
            
            <div class="cocina-grid">
                ${activas.map(c => `
                    <div class="comanda-card ${c.estado}">
                        <div class="comanda-header">
                            <div>
                                <span class="comanda-mesa"><i class="fas fa-chair"></i> Mesa ${c.mesa}</span>
                                ${c.nombre_cliente ? `<div style="font-size: 0.85em; color: #666;">${c.nombre_cliente}</div>` : ''}
                            </div>
                            <div style="text-align: right;">
                                <div class="comanda-time"><i class="fas fa-clock"></i> ${c.hora}</div>
                                <span class="badge badge-${c.estado}">${c.estado}</span>
                            </div>
                        </div>
                        <div class="comanda-items">
                            ${c.items.map(i => `
                                <div class="comanda-item">
                                    <div>
                                        <span class="comanda-item-qty">${i.cantidad}</span>
                                        <strong>${i.nombre}</strong>
                                        ${i.observaciones ? `<div class="comanda-obs"><i class="fas fa-comment"></i> ${i.observaciones}</div>` : ''}
                                    </div>
                                    <div><strong>S/ ${(i.precio * i.cantidad).toFixed(2)}</strong></div>
                                </div>
                            `).join('')}
                        </div>
                        ${c.observaciones ? `
                            <div style="padding: 10px 20px; background: #fff3cd; border-top: 1px solid #eee;">
                                <strong><i class="fas fa-exclamation-triangle"></i> Observación general:</strong><br>
                                <em>${c.observaciones}</em>
                            </div>
                        ` : ''}
                        <div class="comanda-footer">
                            ${c.estado === 'pendiente' ? `
                                <button class="btn btn-success btn-block" onclick="completarComanda(${c.id})">
                                    <i class="fas fa-check"></i> Marcar como Listo
                                </button>
                            ` : `
                                <div class="text-center" style="color: var(--success);">
                                    <i class="fas fa-check-circle"></i> <strong>Listo para Servir</strong>
                                </div>
                            `}
                        </div>
                    </div>
                `).join('')}
            </div>`;
        
        // Auto-refresh cada 30 segundos
        setTimeout(() => {
            if (document.getElementById('page-title')?.textContent?.includes('Cocina')) {
                renderCocina();
            }
        }, 30000);
        
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);"><i class="fas fa-exclamation-circle"></i> Error al cargar comandas<br><button class="btn btn-primary mt-3" onclick="renderCocina()">Reintentar</button></div>';
    }
}

function completarComanda(id) {
    showConfirm('Completar Pedido', '¿Marcar este pedido como listo para servir?', async () => {
        try {
            await fetchAPI(`/comandas/${id}`, { 
                method: 'PUT', 
                body: JSON.stringify({ estado: 'completada' }) 
            });
            showToast('¡Pedido listo para servir!', 'success');
            renderCocina();
        } catch (e) {}
    }, 'fa-check-circle', 'var(--success)');
}