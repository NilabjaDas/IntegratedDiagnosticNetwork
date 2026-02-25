import React, { useState, useEffect } from "react";
import { Modal, Button, Select, List, Avatar, message, Typography, Empty, Tag } from "antd";
import { DeleteOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import { modifyOrderItems } from "../../redux/apiCalls";

const { Option } = Select;
const { Text } = Typography;

const ModifyItemsModal = ({ open, onCancel, order, onSuccess }) => {
  // Access catalog from Redux
  const { tests, packages } = useSelector((state) => state[process.env.REACT_APP_TESTS_DATA_KEY] || state.test);
  
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initialize with existing order items
  useEffect(() => {
    if (open && order && order.items) {
      const mappedItems = order.items.map(item => ({
        _id: item.itemId, // Map back to catalog ID
        name: item.name,
        type: item.itemType,
        price: item.price
      }));
      setSelectedItems(mappedItems);
    }
  }, [open, order]);

  // Handle Multi-Select Changes
  const handleServicesChange = (values) => {
    // values is an array of IDs (strings)
    const newItems = [];

    values.forEach(val => {
        // Check if already in our selected object list to preserve data
        const existing = selectedItems.find(i => i._id === val);
        if (existing) {
            newItems.push(existing);
        } else {
            // Find in catalog
            const testMatch = tests.find(t => t._id === val);
            if (testMatch) {
               newItems.push({ ...testMatch, type: 'Test' });
            } else {
               const pkgMatch = packages.find(p => p._id === val);
               if (pkgMatch) {
                  newItems.push({ ...pkgMatch, price: pkgMatch.offerPrice, type: 'Package' });
               }
            }
        }
    });
    
    setSelectedItems(newItems);
  };

  const handleRemoveItem = (id) => {
    setSelectedItems(selectedItems.filter(i => i._id !== id));
  };

  const handleSave = async () => {
    if (selectedItems.length === 0) return message.error("Order must have at least one item");

    setLoading(true);
    const payload = selectedItems.map(i => ({ _id: i._id, type: i.type }));
    
    const res = await modifyOrderItems(order._id, payload);
    setLoading(false);

    if (res.status === 200) {
      message.success("Order items updated successfully");
      onSuccess();
    } else {
      message.error(res.message);
    }
  };

  // Calculate New Total for preview
  const newTotal = selectedItems.reduce((sum, i) => sum + (i.price || 0), 0);

  return (
    <Modal
      title="Modify Order Items"
      open={open}
      onCancel={onCancel}
      confirmLoading={loading}
      onOk={handleSave}
      maskClosable = {false}
      closable = {true}
      okText={`Save Changes (New Total: ₹${newTotal})`}
    >
      <div style={{ marginBottom: 16 }}>
        <Select
            mode="multiple"
            showSearch
            style={{ width: '100%' }}
            placeholder="Add or remove services..."
            optionFilterProp="children"
            onChange={handleServicesChange}
            value={selectedItems.map(i => i._id)}
            tagRender={() => null} // Hide tags in input, show list below instead
        >
            <Select.OptGroup label="Packages">
                {packages.map(p => (
                    <Option key={p._id} value={p._id}>{p.name} - ₹{p.offerPrice}</Option>
                ))}
            </Select.OptGroup>
            <Select.OptGroup label="Individual Tests">
                {tests.map(t => (
                    <Option key={t._id} value={t._id}>{t.name} - ₹{t.price}</Option>
                ))}
            </Select.OptGroup>
        </Select>
      </div>
      <div style={{maxHeight: '50vh', overflow: 'auto'}}>
      
      <List
        itemLayout="horizontal"
        dataSource={selectedItems}
        locale={{ emptyText: <Empty description="No items selected" /> }}
        renderItem={item => (
            <List.Item
                actions={[
                    <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemoveItem(item._id)} />
                ]}
            >
                <List.Item.Meta
                    avatar={<Avatar icon={<MedicineBoxOutlined />} style={{ backgroundColor: item.type === 'Package' ? '#87d068' : '#1890ff' }} />}
                    title={item.name}
                    description={<Tag>{item.type}</Tag>}
                />
                <div>₹{item.price}</div>
            </List.Item>
        )}
      />
        
      </div>
      <div style={{ marginTop: 10, color: '#888', fontSize: '12px' }}>
        Note: Modifying items will recalculate the order total. Previous payments will be retained as "Paid Amount", potentially resulting in a Due or Refund status.
      </div>
    </Modal>
  );
};

export default ModifyItemsModal;