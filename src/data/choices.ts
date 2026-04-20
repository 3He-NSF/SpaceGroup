export const CRYSTAL_SYSTEM_CHOICES = [
  { value: "triclinic", label: "三斜晶系 / triclinic" },
  { value: "monoclinic", label: "単斜晶系 / monoclinic" },
  { value: "orthorhombic", label: "斜方晶系 / orthorhombic" },
  { value: "tetragonal", label: "正方晶系 / tetragonal" },
  { value: "trigonal", label: "三方晶系 / trigonal" },
  { value: "hexagonal", label: "六方晶系 / hexagonal" },
  { value: "cubic", label: "立方晶系 / cubic" },
] as const;

export const CENTRING_TYPE_CHOICES = [
  { value: "P", label: "P / primitive" },
  { value: "A", label: "A / A-centered" },
  { value: "B", label: "B / B-centered" },
  { value: "C", label: "C / C-centered" },
  { value: "I", label: "I / body-centered" },
  { value: "F", label: "F / face-centered" },
  { value: "R", label: "R / rhombohedral" },
] as const;

export const MIRROR_PLANE_CHOICES = [
  { value: "x", label: "x軸に垂直（yz 面）" },
  { value: "y", label: "y軸に垂直（xz 面）" },
  { value: "z", label: "z軸に垂直（xy 面）" },
  { value: "none", label: "鏡映面なし" },
] as const;

export const GLIDE_PLANE_CHOICES = [
  { value: "a", label: "a-glide" },
  { value: "b", label: "b-glide" },
  { value: "c", label: "c-glide" },
  { value: "n", label: "n-glide" },
  { value: "d", label: "d-glide" },
  { value: "none", label: "映進面なし" },
] as const;

export const SCREW_AXIS_CHOICES = [
  { value: "x", label: "x 軸方向" },
  { value: "y", label: "y 軸方向" },
  { value: "z", label: "z 軸方向" },
  { value: "none", label: "らせん軸なし" },
] as const;

export const SCREW_TYPE_CHOICES = [
  { value: "21", label: "2₁" },
  { value: "31", label: "3₁" },
  { value: "32", label: "3₂" },
  { value: "41", label: "4₁" },
  { value: "42", label: "4₂" },
  { value: "43", label: "4₃" },
  { value: "61", label: "6₁" },
  { value: "62", label: "6₂" },
  { value: "63", label: "6₃" },
  { value: "64", label: "6₄" },
  { value: "65", label: "6₅" },
  { value: "none", label: "らせん軸なし" },
] as const;

export const CENTRING_EXTINCTION_CHOICES = [
  { value: "h+k=2n", label: "h + k = 2n" },
  { value: "h+l=2n", label: "h + l = 2n" },
  { value: "k+l=2n", label: "k + l = 2n" },
  { value: "h+k+l=2n", label: "h + k + l = 2n" },
  { value: "-h+k+l=3n", label: "-h + k + l = 3n" },
  { value: "all-odd-or-even", label: "h, k, l がすべて偶数またはすべて奇数" },
  { value: "none", label: "条件なし（すべてのhkl）" },
] as const;

export const GLIDE_EXTINCTION_CHOICES = [
  { value: "hk0:h=2n", label: "hk0: h = 2n" },
  { value: "hk0:k=2n", label: "hk0: k = 2n" },
  { value: "h0l:h=2n", label: "h0l: h = 2n" },
  { value: "h0l:l=2n", label: "h0l: l = 2n" },
  { value: "0kl:k=2n", label: "0kl: k = 2n" },
  { value: "0kl:l=2n", label: "0kl: l = 2n" },
  { value: "hk0:h+k=2n", label: "hk0:h + k = 2n" }, // n-glide
  { value: "hl0:h+l=2n", label: "hl0:h + l = 2n" },
  { value: "kl0:k+l=2n", label: "kl0:k + l = 2n" },
  { value: "hk0:h+k=4n", label: "hk0:h + k = 4n" }, // d-glide
  { value: "h0l:h+l=4n", label: "h0l: h + l = 4n" }, // d-glide
  { value: "0kl:k+l=4n", label: "0kl: k + l = 4n" }, // d-glide
  { value: "none", label: "条件なし" },
] as const;

export const SCREW_EXTINCTION_CHOICES = [
  { value: "h00:h=2n", label: "h00: h = 2n" },
  { value: "h00:h=4n", label: "h00: h = 4n" },
  { value: "0k0:k=2n", label: "0k0: k = 2n" },
  { value: "0k0:k=4n", label: "0k0: k = 4n" },
  { value: "00l:l=2n", label: "00l: l = 2n" },
  { value: "00l:l=4n", label: "00l: l = 4n" },
  { value: "h00:h=3n", label: "h00: h = 3n" },
  { value: "0k0:k=3n", label: "0k0: k = 3n" },
  { value: "00l:l=6n", label: "00l: l = 6n" },
  { value: "none", label: "条件なし" },
] as const;
