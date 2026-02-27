import React from 'react';
import { Row, Col, Input, Select, Button, InputNumber, Tag, Divider, Space, Typography } from 'antd';
import { UserAddOutlined, SearchOutlined, CloseCircleOutlined, CalendarOutlined, ClearOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Title, Text } = Typography;

const BookingPatientSelect = ({
    patientSearchRef, walkinNameRef, searchResults, patientId, selectedPatientOriginal,
    patientForm, setPatientForm, handlePatientSearch, handleSelectRegistered,
    handleClearSelection, setIsPatientModalOpen, resetForm
}) => {
    return (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Space>
                    <CalendarOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                    <Title level={5} style={{ margin: 0 }}>Book Appointment</Title>
                </Space>
                <Button size="small" type="dashed" danger icon={<ClearOutlined />} onClick={resetForm}>Reset</Button>
            </div>

            <Row gutter={12} align="middle">
                <Col span={10}>
                    <Input.Group compact>
                        <Select
                            ref={patientSearchRef}
                            showSearch
                            size="small"
                            style={{ width: "calc(100% - 24px)" }}
                            placeholder="Search Patient (F1)"
                            filterOption={false}
                            onSearch={handlePatientSearch}
                            onChange={handleSelectRegistered}
                            value={patientId}
                            suffixIcon={<SearchOutlined />}
                            allowClear
                            onClear={handleClearSelection}
                        >
                            {searchResults?.map((p) => (
                                <Option key={p._id} value={p._id}>{p.firstName} {p.lastName} ({p.mobile})</Option>
                            ))}
                        </Select>
                        <Button size="small" icon={<UserAddOutlined />} onClick={() => setIsPatientModalOpen(true)} />
                    </Input.Group>
                </Col>
                <Col span={14}>
                    {!patientId ? (
                        <Row gutter={8}>
                            <Col span={10}>
                                <Input size="small" ref={walkinNameRef} placeholder="Walk-in Name (F2)" value={patientForm.name} onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })} />
                            </Col>
                            <Col span={6}>
                                <InputNumber size="small" placeholder="Age" min={1} style={{ width: "100%" }} value={patientForm.age} onChange={(v) => setPatientForm({ ...patientForm, age: v })} />
                            </Col>
                            <Col span={8}>
                                <Select size="small" value={patientForm.gender} onChange={(v) => setPatientForm({ ...patientForm, gender: v })} style={{ width: "100%" }}>
                                    <Option value="Male">Male</Option>
                                    <Option value="Female">Female</Option>
                                </Select>
                            </Col>
                        </Row>
                    ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", height: 24, fontSize: 12 }}>
                            <Tag color="blue" style={{ margin: 0 }}>{selectedPatientOriginal?.uhid}</Tag>
                            <Text strong>{patientForm.name}</Text>
                            <Divider type="vertical" />
                            <InputNumber size="small" min={1} value={patientForm.age} onChange={(v) => setPatientForm({ ...patientForm, age: v })} style={{ width: 50 }} />
                            <Select size="small" value={patientForm.gender} onChange={(v) => setPatientForm({ ...patientForm, gender: v })} style={{ width: 70 }}>
                                <Option value="Male">M</Option><Option value="Female">F</Option>
                            </Select>
                            <Button type="text" danger icon={<CloseCircleOutlined />} onClick={handleClearSelection} size="small" style={{ padding: 0 }} />
                        </div>
                    )}
                </Col>
            </Row>
        </div>
    );
};

export default BookingPatientSelect;