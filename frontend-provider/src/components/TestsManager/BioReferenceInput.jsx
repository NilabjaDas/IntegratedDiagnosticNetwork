import React, { useState, useEffect } from 'react';
import { InputNumber, Button, Row, Col, AutoComplete } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const PREDEFINED_GROUPS = [
  { value: 'General' },
  { value: 'Male' },
  { value: 'Female' },
  { value: 'Child' },
  { value: 'Newborn' },
  { value: 'Adult' },
  { value: 'Senior' }
];

const BioReferenceInput = ({ value = {}, onChange }) => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    // Only parse if we have a value and rows haven't been touched yet
    if (value && typeof value === 'object' && Object.keys(value).length > 0) {
      if (rows.length === 0) {
        
        // DETECTION LOGIC:
        // Case 1: Simple Structure { min: 1.5, max: 4.5 }
        if ('min' in value || 'max' in value) {
          setRows([{
            type: 'General', // Assign a default label
            min: value.min, 
            max: value.max
          }]);
        } 
        // Case 2: Grouped Structure { "Male": { min, max }, ... }
        else {
          const parsedData = Object.entries(value).map(([key, val]) => ({
            type: key,
            min: val?.min, // Optional chaining handles malformed sub-objects
            max: val?.max
          }));
          setRows(parsedData);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const triggerChange = (newRows) => {
    setRows(newRows);
    
    // Always save back in the Grouped Structure for consistency going forward
    const payload = newRows.reduce((acc, row) => {
      if (row.type && row.type.trim() !== '') {
        acc[row.type] = { 
            min: row.min !== null ? row.min : 0, 
            max: row.max !== null ? row.max : 0 
        };
      }
      return acc;
    }, {});

    onChange?.(payload);
  };

  const handleAdd = () => {
    triggerChange([...rows, { type: '', min: 0, max: 0 }]);
  };

  const handleRemove = (index) => {
    const newRows = rows.filter((_, i) => i !== index);
    triggerChange(newRows);
  };

  const handleChange = (index, field, val) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: val };
    triggerChange(newRows);
  };

  return (
    <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '6px', border: '1px solid #eee' }}>
      {rows.length > 0 && (
        <Row gutter={8} style={{ marginBottom: 5, fontSize: '12px', color: '#888' }}>
          <Col span={9}>Group / Gender</Col>
          <Col span={6}>Min</Col>
          <Col span={6}>Max</Col>
          <Col span={3}></Col>
        </Row>
      )}

      {rows.map((row, index) => (
        <Row key={index} gutter={8} style={{ marginBottom: 8 }} align="middle">
          <Col span={9}>
            <AutoComplete
              options={PREDEFINED_GROUPS}
              placeholder="e.g. Male"
              value={row.type}
              onChange={(val) => handleChange(index, 'type', val)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={6}>
            <InputNumber
              placeholder="Min"
              value={row.min}
              onChange={(val) => handleChange(index, 'min', val)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={6}>
            <InputNumber
              placeholder="Max"
              value={row.max}
              onChange={(val) => handleChange(index, 'max', val)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={3}>
            <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={() => handleRemove(index)} 
            />
          </Col>
        </Row>
      ))}

      <Button type="dashed" onClick={handleAdd} block icon={<PlusOutlined />} size="small">
        Add Reference Range
      </Button>
    </div>
  );
};

export default BioReferenceInput;