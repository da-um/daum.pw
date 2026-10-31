// Everything the page says. Keep it to names and links.

export const works = {
  // Embedded, it opens at its star map and says where its stars are (lib/qiqi.ts).
  qiqi: { name: 'qiqi.help', url: 'https://qiqi.help', embed: 'https://qiqi.help/?embed=daum12569' },
  daumini: { name: 'daumini', url: 'https://mini.daum.pw' },
};

export const mail = 'daum12569@gmail.com';

// Accounts to add by their ID: shown, and copied on a click.
export const ids = [
  { label: '微信', value: 'daum12569' },
  { label: 'QQ', value: '2470293966' },
  { label: 'Telegram', value: '5033765858' },
];

export const contacts = [
  { label: 'GitHub', url: 'https://github.com/daum110715' },
  { label: 'Bilibili', url: 'https://space.bilibili.com/3546731002202994' },
];

// qiqi.help star map: characters per nation, as listed on qiqi.help.
export const nations: [string, number][] = [
  ['蒙德', 24],
  ['璃月', 21],
  ['稻妻', 17],
  ['须弥', 14],
  ['枫丹', 13],
  ['纳塔', 11],
  ['至冬', 7],
  ['挪德卡莱', 10],
  ['其他', 4],
];
