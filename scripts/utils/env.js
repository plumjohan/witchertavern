export default (() => {
  const { host } = window.location;
  if (host.endsWith('.live')) return 'prod';
  if (!['--', 'local'].some((check) => host.includes(check))) return 'prod';
  if (['--'].some((check) => host.includes(check))) return 'dev';
  return 'dev';
})();

export const isEdsUrl = () => {
  const { host } = window.location;
  return host.indexOf('localhost') > -1 || host.endsWith('.live') || host.endsWith('.page');
}