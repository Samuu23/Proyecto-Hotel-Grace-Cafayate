import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RoomMap() {
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [reserveInfo, setReserveInfo] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [roomTypes, setRoomTypes] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({ capacity: 0, base_price: 0, id_room_type: null })
  const [allReserves, setAllReserves] = useState([])
  const [loadingReserves, setLoadingReserves] = useState(false)
  const [showReserves, setShowReserves] = useState(false)

  // Cargar habitaciones y sus estados
  const loadRooms = async () => {
    try {
      setLoading(true)
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('id_room, room_number, capacity, base_price, is_open, id_room_type, room_type:id_room_type(id_room_type, name)')
        .order('room_number', { ascending: true })

      if (roomsError) throw roomsError

      // Obtener reservas activas: vigentes hoy o que comienzan hoy
      const today = new Date().toISOString().slice(0, 10)
      console.log('RoomMap - Buscando reservas activas para:', today)
      
      const { data: reservesData, error: reservesError } = await supabase
        .from('reserve')
        .select('id_reserve, id_room, id_user, check_in, check_out, status')
        .in('status', ['pendiente', 'confirmada'])
        .lte('check_in', today)  // Comienzan hoy o antes
        .gte('check_out', today)  // Terminan hoy o después
      
      if (reservesError) {
        console.error('Error al cargar reservas:', reservesError)
      }
      
      console.log('RoomMap - Reservas activas encontradas:', reservesData)
      
      // Obtener información de usuarios si hay reservas
      let reservesWithUsers = []
      if (reservesData && reservesData.length > 0) {
        const userIds = [...new Set(reservesData.map(r => r.id_user).filter(Boolean))]
        const { data: usersData } = await supabase
          .from('users')
          .select('id_user, name_user, surname_user, email_user')
          .in('id_user', userIds)
        
        const usersMap = Object.fromEntries((usersData || []).map(u => [u.id_user, u]))
        reservesWithUsers = reservesData.map(r => ({
          ...r,
          users: usersMap[r.id_user] || null
        }))
      }

      // Mapear estados de habitaciones
      const occupiedRoomIds = new Set((reservesWithUsers || []).map(r => r.id_room))
      console.log('RoomMap - Habitaciones ocupadas:', occupiedRoomIds)
      
      const reservesByRoom = {}
      for (const reserve of (reservesWithUsers || [])) {
        reservesByRoom[reserve.id_room] = reserve
      }

      const roomsWithStatus = (roomsData || []).map(room => {
        let status = 'available' // verde
        const isOccupied = occupiedRoomIds.has(room.id_room)
        
        if (!room.is_open) {
          status = 'disabled' // amarillo - cerrada manualmente
        } else if (isOccupied) {
          status = 'occupied' // rojo - tiene reserva activa
        }

        return {
          ...room,
          status,
          typeName: room.room_type?.name || 'N/A',
          reserve: reservesByRoom[room.id_room] || null
        }
      })

      console.log('RoomMap - Habitaciones con estado:', roomsWithStatus.map(r => ({ 
        number: r.room_number, 
        status: r.status, 
        is_open: r.is_open,
        has_reserve: !!r.reserve 
      })))
      
      setRooms(roomsWithStatus)
    } catch (error) {
      console.error('Error al cargar habitaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  // Cargar tipos de habitación
  const loadRoomTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('room_type')
        .select('id_room_type, name')
        .order('name', { ascending: true })
      
      if (error) throw error
      setRoomTypes(data || [])
    } catch (error) {
      console.error('Error al cargar tipos de habitación:', error)
    }
  }

  useEffect(() => {
    loadRooms()
    loadRoomTypes()
    
    // Realtime updates
    const channel = supabase.channel('room-map-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, loadRooms)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reserve' }, loadRooms)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const loadRoomReserves = async (roomId) => {
    setLoadingReserves(true)
    try {
      const { data, error } = await supabase
        .from('reserve')
        .select('id_reserve, check_in, check_out, adults_total, children_total, status, payment_status, total_amount, created_at, id_user')
        .eq('id_room', roomId)
        .order('check_in', { ascending: false })
      
      if (error) throw error
      
      // Obtener información de usuarios por separado
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.id_user).filter(Boolean))]
        const { data: usersData } = await supabase
          .from('users')
          .select('id_user, name_user, surname_user, email_user')
          .in('id_user', userIds)
        
        const usersMap = Object.fromEntries((usersData || []).map(u => [u.id_user, u]))
        
        // Combinar reservas con datos de usuarios
        const reservesWithUsers = data.map(reserve => ({
          ...reserve,
          users: usersMap[reserve.id_user] || null
        }))
        
        setAllReserves(reservesWithUsers)
      } else {
        setAllReserves([])
      }
    } catch (error) {
      console.error('Error al cargar reservas:', error)
      setAllReserves([])
    } finally {
      setLoadingReserves(false)
    }
  }

  const handleRoomClick = (room) => {
    setSelectedRoom(room)
    setReserveInfo(room.reserve)
    setEditMode(false)
    setShowReserves(false)
    setEditData({
      capacity: room.capacity,
      base_price: room.base_price,
      id_room_type: room.id_room_type || room.room_type?.id_room_type
    })
    loadRoomReserves(room.id_room)
  }

  const toggleRoomStatus = async () => {
    if (!selectedRoom) return
    setUpdating(true)
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ is_open: !selectedRoom.is_open })
        .eq('id_room', selectedRoom.id_room)

      if (error) throw error
      await loadRooms()
      setSelectedRoom(null)
    } catch (error) {
      console.error('Error al actualizar habitación:', error)
      alert('No se pudo actualizar la habitación')
    } finally {
      setUpdating(false)
    }
  }

  const saveRoomChanges = async () => {
    if (!selectedRoom) return
    setUpdating(true)
    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          capacity: Number(editData.capacity),
          base_price: Number(editData.base_price),
          id_room_type: editData.id_room_type
        })
        .eq('id_room', selectedRoom.id_room)

      if (error) throw error
      await loadRooms()
      setEditMode(false)
      setSelectedRoom(null)
    } catch (error) {
      console.error('Error al actualizar habitación:', error)
      alert('No se pudo actualizar la habitación')
    } finally {
      setUpdating(false)
    }
  }

  // Agrupar habitaciones por piso
  const groupByFloor = () => {
    const floors = { 1: [], 2: [], 3: [], 4: [] }
    rooms.forEach(room => {
      const floorNum = Math.floor(parseInt(room.room_number) / 100)
      if (floors[floorNum]) {
        floors[floorNum].push(room)
      }
    })
    return floors
  }

  const floors = groupByFloor()

  // Obtener color según estado
  const getStatusColor = (status) => {
    if (status === 'available') return 'bg-green-500/80 hover:bg-green-500 border-green-400'
    if (status === 'occupied') return 'bg-red-500/80 hover:bg-red-500 border-red-400'
    if (status === 'disabled') return 'bg-yellow-500/80 hover:bg-yellow-500 border-yellow-400'
    return 'bg-gray-500/80'
  }

  const getStatusText = (status) => {
    if (status === 'available') return 'Disponible'
    if (status === 'occupied') return 'Ocupada'
    if (status === 'disabled') return 'Deshabilitada'
    return 'Desconocido'
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="mb-2">Cargando mapa de habitaciones...</div>
        <div className="text-xs opacity-60">Si tarda mucho, verificá la consola (F12)</div>
      </div>
    )
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="mb-2">No hay habitaciones para mostrar</div>
        <button onClick={loadRooms} className="text-sm px-4 py-2 rounded border border-white/20 mt-2">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {[4, 3, 2, 1].map(floorNum => {
        const floorRooms = floors[floorNum] || []
        if (floorRooms.length === 0) return null

        // Dividir en dos filas (5 arriba, 5 abajo)
        const topRow = floorRooms.slice(0, 5)
        const bottomRow = floorRooms.slice(5, 10)

        return (
          <div key={floorNum} className="rounded-xl border border-white/15 bg-black/10 p-6">
            <h3 className="text-xl font-semibold mb-4">Piso {floorNum}</h3>
            
            {/* Estructura del pasillo */}
            <div className="space-y-3">
              {/* Fila superior */}
              <div className="grid grid-cols-5 gap-3">
                {topRow.map(room => (
                  <button
                    key={room.id_room}
                    onClick={() => handleRoomClick(room)}
                    className={`${getStatusColor(room.status)} border-2 rounded-lg p-4 transition-all cursor-pointer text-center`}
                  >
                    <div className="font-bold text-lg">{room.room_number}</div>
                    <div className="text-xs mt-1 opacity-90">{room.typeName}</div>
                  </button>
                ))}
              </div>

              {/* Pasillo */}
              <div className="h-12 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded flex items-center justify-center">
                <span className="text-xs opacity-60">── PASILLO ──</span>
              </div>

              {/* Fila inferior */}
              <div className="grid grid-cols-5 gap-3">
                {bottomRow.map(room => (
                  <button
                    key={room.id_room}
                    onClick={() => handleRoomClick(room)}
                    className={`${getStatusColor(room.status)} border-2 rounded-lg p-4 transition-all cursor-pointer text-center`}
                  >
                    <div className="font-bold text-lg">{room.room_number}</div>
                    <div className="text-xs mt-1 opacity-90">{room.typeName}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Leyenda */}
      <div className="flex gap-4 justify-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded border border-green-400"></div>
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded border border-red-400"></div>
          <span>Ocupada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded border border-yellow-400"></div>
          <span>Deshabilitada</span>
        </div>
      </div>

      {/* Modal de información */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRoom(null)}>
          <div className="bg-gray-900 rounded-xl border border-white/15 p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4">
              Habitación {selectedRoom.room_number} - {selectedRoom.typeName}
            </h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="opacity-80">Estado:</span>
                <span className="font-semibold">{getStatusText(selectedRoom.status)}</span>
              </div>
              
              {editMode ? (
                <>
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Tipo de habitación:</label>
                    <select 
                      value={editData.id_room_type || ''} 
                      onChange={(e) => setEditData(prev => ({ ...prev, id_room_type: Number(e.target.value) }))}
                      className="w-full bg-gray-800 rounded-lg border border-white/15 px-3 py-2"
                    >
                      <option value="">Seleccionar tipo</option>
                      {roomTypes.map(type => (
                        <option key={type.id_room_type} value={type.id_room_type}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Capacidad:</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={editData.capacity}
                      onChange={(e) => setEditData(prev => ({ ...prev, capacity: e.target.value }))}
                      className="w-full bg-gray-800 rounded-lg border border-white/15 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Precio base:</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={editData.base_price}
                      onChange={(e) => setEditData(prev => ({ ...prev, base_price: e.target.value }))}
                      className="w-full bg-gray-800 rounded-lg border border-white/15 px-3 py-2"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="opacity-80">Tipo:</span>
                    <span className="font-semibold">{selectedRoom.typeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-80">Capacidad:</span>
                    <span className="font-semibold">{selectedRoom.capacity} personas</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-80">Precio base:</span>
                    <span className="font-semibold">${selectedRoom.base_price}</span>
                  </div>
                </>
              )}
            </div>

            {/* Información de reserva si está ocupada */}
            {selectedRoom.status === 'occupied' && reserveInfo && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-400/40">
                <h3 className="font-semibold mb-2">Reserva Actual (Hoy)</h3>
                <div className="text-sm space-y-1">
                  <div>Cliente: {reserveInfo.users?.name_user} {reserveInfo.users?.surname_user}</div>
                  <div>Email: {reserveInfo.users?.email_user}</div>
                  <div>Check-in: {reserveInfo.check_in}</div>
                  <div>Check-out: {reserveInfo.check_out}</div>
                  <div>Estado: {reserveInfo.status}</div>
                </div>
              </div>
            )}

            {/* Historial de reservas */}
            <div className="mb-6">
              <button
                onClick={() => setShowReserves(!showReserves)}
                className="w-full flex items-center justify-between px-4 py-2 rounded-lg border border-white/20 hover:border-white/30 transition"
              >
                <span className="font-semibold">
                  {showReserves ? 'Ocultar' : 'Ver'} Historial de Reservas ({allReserves.length})
                </span>
                <span>{showReserves ? '▲' : '▼'}</span>
              </button>

              {showReserves && (
                <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                  {loadingReserves ? (
                    <p className="text-sm text-center opacity-80 py-4">Cargando reservas...</p>
                  ) : allReserves.length === 0 ? (
                    <p className="text-sm text-center opacity-80 py-4">No hay reservas para esta habitación</p>
                  ) : (
                    allReserves.map(reserve => {
                      const today = new Date().toISOString().slice(0, 10)
                      const isActive = reserve.check_in <= today && reserve.check_out >= today
                      const isFuture = reserve.check_in > today
                      const statusColor = isActive ? 'bg-green-500/20 border-green-400/40' : 
                                         isFuture ? 'bg-blue-500/20 border-blue-400/40' : 
                                         'bg-gray-500/20 border-gray-400/40'
                      
                      return (
                        <div key={reserve.id_reserve} className={`p-3 rounded-lg border ${statusColor}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="text-sm font-semibold">
                              {reserve.users?.name_user} {reserve.users?.surname_user}
                            </div>
                            <div className="text-xs px-2 py-1 rounded bg-white/10">
                              {reserve.status}
                            </div>
                          </div>
                          <div className="text-xs space-y-1 opacity-90">
                            <div>📅 {reserve.check_in} → {reserve.check_out}</div>
                            <div>👥 {reserve.adults_total + reserve.children_total} huéspedes</div>
                            <div>💰 ${reserve.total_amount} · {reserve.payment_status}</div>
                            <div>📧 {reserve.users?.email_user}</div>
                          </div>
                          {isActive && (
                            <div className="mt-2 text-xs text-green-400 font-semibold">● ACTIVA</div>
                          )}
                          {isFuture && (
                            <div className="mt-2 text-xs text-blue-400 font-semibold">● PRÓXIMA</div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div className="space-y-3">
              {editMode ? (
                <div className="flex gap-3">
                  <button
                    onClick={saveRoomChanges}
                    disabled={updating}
                    className="flex-1 rounded-lg px-4 py-2 bg-green-600 hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {updating ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    disabled={updating}
                    className="flex-1 rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex-1 rounded-lg px-4 py-2 bg-purple-600 hover:bg-purple-700 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={toggleRoomStatus}
                      disabled={updating || selectedRoom.status === 'occupied'}
                      className="flex-1 rounded-lg px-4 py-2 bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating ? 'Actualizando...' : selectedRoom.is_open ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedRoom(null)}
                    className="w-full rounded-lg px-4 py-2 border border-white/20 hover:border-white/30 transition"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </div>

            {selectedRoom.status === 'occupied' && !editMode && (
              <p className="text-xs text-yellow-400 mt-3">
                * No se puede deshabilitar una habitación ocupada
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
