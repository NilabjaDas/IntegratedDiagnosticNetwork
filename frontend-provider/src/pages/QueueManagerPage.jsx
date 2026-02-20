import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDepartmentQueue, updateTokenStatus } from '../redux/apiCalls';

const QueueManagerPage = () => {
    const dispatch = useDispatch();

    // 1. Fetching Global User Data from Redux

    // 2. Fetching the Live Queue from Redux
    // Note: Adjust 'state.token.queue' if you named your array differently in tokenRedux.js
    const queue = useSelector((state) =>  state[process.env.REACT_APP_QUEUE_DATA_KEY]?.queue || []); 
    console.log(queue)
    // 3. Local UI State for Department Selection
    const [department, setDepartment] = useState('Pathology');

    // 4. Initial Fetch on Mount or Department Change
    useEffect(() => {
        if (department  ) {
            // Passing dispatch so apiCalls.js can update the Redux store with the payload
            fetchDepartmentQueue(dispatch, department);
        }
    }, [dispatch, department, ]);

    // 5. Handling Technician Actions
    const handleAction = async (tokenId, action) => {
        try {
            // This API call triggers the backend to update the DB and fire an SSE event.
            // App.jsx will catch the SSE and automatically update the Redux store!
            await updateTokenStatus(dispatch, tokenId, action);
        } catch (error) {
            console.error(`Failed to update token status to ${action}`, error);
            // Optional: Implement a toast/snackbar notification here
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>{department} Queue Management</h2>
                
                <select 
                    value={department} 
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                    <option value="Pathology">Pathology</option>
                    <option value="Radiology">Radiology</option>
                    <option value="Cardiology">Cardiology</option>
                </select>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <thead style={{ backgroundColor: '#f8f9fa' }}>
                    <tr>
                        <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6' }}>Token</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6' }}>Patient Name</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6' }}>Tests</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6' }}>Status</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {queue.length > 0 ? queue.map((token) => (
                        <tr key={token._id} style={{ 
                            borderBottom: '1px solid #eee',
                            backgroundColor: token.status === 'HOLD' ? '#fff3cd' : 'transparent',
                            transition: 'background-color 0.3s'
                        }}>
                            <td style={{ padding: '12px' }}><strong>{token.tokenNumber}</strong></td>
                            <td style={{ padding: '12px' }}>{token.patientDetails?.name || 'Unknown Patient'}</td>
                            <td style={{ padding: '12px' }}>{token.tests?.map(t => t.name).join(", ")}</td>
                            <td style={{ padding: '12px' }}>
                                <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.85em',
                                    fontWeight: 'bold',
                                    backgroundColor: 
                                        token.status === 'WAITING' ? '#e2e3e5' :
                                        token.status === 'CALLED' ? '#cce5ff' :
                                        token.status === 'IN_PROGRESS' ? '#d4edda' :
                                        '#fff3cd',
                                    color: 
                                        token.status === 'WAITING' ? '#383d41' :
                                        token.status === 'CALLED' ? '#004085' :
                                        token.status === 'IN_PROGRESS' ? '#155724' :
                                        '#856404'
                                }}>
                                    {token.status}
                                </span>
                            </td>
                            <td style={{ padding: '12px', gap: '8px', display: 'flex' }}>
                                {token.status === 'WAITING' && (
                                    <button onClick={() => handleAction(token._id, 'CALL')} style={btnStyle('#007bff')}>Call</button>
                                )}
                                {token.status === 'CALLED' && (
                                    <>
                                        <button onClick={() => handleAction(token._id, 'START')} style={btnStyle('#28a745')}>Start</button>
                                        <button onClick={() => handleAction(token._id, 'HOLD')} style={btnStyle('#ffc107', '#333')}>Hold</button>
                                    </>
                                )}
                                {token.status === 'IN_PROGRESS' && (
                                    <button onClick={() => handleAction(token._id, 'COMPLETE')} style={btnStyle('#17a2b8')}>Complete</button>
                                )}
                                {token.status === 'HOLD' && (
                                    <button onClick={() => handleAction(token._id, 'CALL')} style={btnStyle('#6c757d')}>Recall</button>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                No patients currently in the {department} queue!
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

// Helper for quick inline button styling
const btnStyle = (bg, color = '#fff') => ({
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: bg,
    color: color,
    cursor: 'pointer',
    fontWeight: 'bold'
});

export default QueueManagerPage;