// src/themes.js
export const darkTheme = {
  token: {
    // Seed Token
    colorPrimary: '#1677ff',
    borderRadius: 4,

    // Base Colors
    colorBgBase: '#000000',
    colorBgContainer: '#141414',

    // Text
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255, 255, 255, 0.65)',

    // Borders
    colorBorder: '#303030',
  },
  components: {
    Layout: {
      headerBg: '#141414',
      bodyBg: '#000000',
      siderBg: '#000000',
    },
    Menu: {
      darkItemBg: '#000000',
      darkItemSelectedBg: '#111b26',
      darkItemColor: 'rgba(255, 255, 255, 0.85)',
      darkItemSelectedColor: '#1677ff',
    },
    Button: {
      primaryColor: 'white',
      defaultBorderColor: '#303030',
      defaultColor: 'white',
      defaultBg: 'transparent',
    },
    Switch: {
      colorPrimary: '#1677ff',
      colorText: 'white',
    },
    Breadcrumb: {
      itemColor: '#ffffff',      // Standard items
      lastItemColor: '#ffffff',  // The active/last item
      separatorColor: '#ffffff', // The "/" separator
      linkColor: '#ffffff',      // Links
    },
  },
};