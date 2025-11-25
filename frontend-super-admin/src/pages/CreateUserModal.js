import React, { useState } from 'react';
import { Modal, Form, Input, Button } from 'antd';
import { createUser } from '../services/api';
import { toast } from 'react-toastify';

const CreateUserModal = ({ open, onCancel, onOk, institutionId }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleOk = async (values) => {
        setLoading(true);
        try {
            await createUser(institutionId, values);
            toast.success("User created successfully");
            onOk();
        } catch (error) {
            toast.error("Failed to create user");
        } finally {
            setLoading(false);
            form.resetFields();
        }
    };

    return (
        <Modal
            title="Create New Admin User"
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="back" onClick={onCancel}>
                    Cancel
                </Button>,
                <Button key="submit" type="primary" loading={loading} onClick={() => form.submit()}>
                    Create
                </Button>,
            ]}
        >
            <Form form={form} onFinish={handleOk} layout="vertical">
                <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please input the user\'s name!' }]}>
                    <Input />
                </Form.Item>
                <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Please input the user\'s email!' }]}>
                    <Input type="email" />
                </Form.Item>
                 <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Please input the user\'s phone!' }]}>
                    <Input />
                </Form.Item>
                <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please input a password!' }]}>
                    <Input.Password />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateUserModal;
