export default function (HOCFactory) {
  return HOCFactory(({table}) => table, {}, 'onDisplayChange');
}
