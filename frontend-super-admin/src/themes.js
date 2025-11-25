// src/themes.js
export const darkTheme = {
  token: {
    // Seed Token
    colorPrimary: '#1677ff',
    borderRadius: 2,

    // Alias Token
    colorBgContainer: '#000000',
    colorText: 'white',
    colorTextDescription: 'rgba(255, 255, 255, 0.65)',
    colorBorder: '#424242',
  },
  components: {
    Layout: {
      headerBg: '#000000',
      siderBg: '#000000',
    },
    Menu: {
      darkItemBg: '#000000',
      darkItemSelectedBg: '#1677ff',
      darkItemColor: 'white',
      darkItemSelectedColor: 'white',
    },
    Button: {
      primaryColor: 'white',
      defaultBorderColor: '#424242',
      defaultColor: 'white',
    },
    Switch: {
      colorPrimary: '#1677ff',
      colorText: 'white',
    },
    Breadcrumb: {
      itemColor: 'white',
      lastItemColor: 'rgba(255, 255, 255, 0.65)',
    },
  },
};
