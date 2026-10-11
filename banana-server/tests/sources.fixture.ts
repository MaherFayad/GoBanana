/**
 * Realistic Serper images response, shaped like a live reply
 * (fields: title, imageUrl, imageWidth, imageHeight, thumbnailUrl, thumbnailWidth,
 * thumbnailHeight, source, domain, link, position). URLs are made up.
 */
export const serperFixture = {
  searchParameters: {
    q: "brutalist bakery menu (site:pinterest.com OR site:dribbble.com)",
    type: "images",
    num: 30,
    engine: "google",
  },
  images: [
    {
      title: "Brutalist bakery menu poster",
      imageUrl: "https://i.pinimg.com/originals/aa/bb/cc/aabbcc0011.jpg",
      imageWidth: 736,
      imageHeight: 1104,
      thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1",
      thumbnailWidth: 183,
      thumbnailHeight: 275,
      source: "Pinterest",
      domain: "www.pinterest.com",
      link: "https://www.pinterest.com/pin/123456789012345678/",
      position: 1,
    },
    {
      title: "Bakery identity, raw grid",
      imageUrl: "https://cdn.dribbble.com/userupload/1234567/file/original-abc.png?resize=1600x1200",
      imageWidth: 1600,
      imageHeight: 1200,
      thumbnailUrl: "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcR2",
      thumbnailWidth: 259,
      thumbnailHeight: 194,
      source: "Dribbble",
      domain: "dribbble.com",
      link: "https://dribbble.com/shots/23456789-Bakery-identity",
      position: 2,
    },
    {
      // Behance is not selected in the default sources: dropped.
      title: "Bakery brand on Behance",
      imageUrl: "https://mir-s3-cdn-cf.behance.net/project_modules/1400/abc.jpg",
      imageWidth: 1400,
      imageHeight: 1050,
      thumbnailUrl: "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcR3",
      source: "Behance",
      domain: "www.behance.net",
      link: "https://www.behance.net/gallery/111/Bakery",
      position: 3,
    },
    {
      // No source link: dropped.
      title: "Orphan image",
      imageUrl: "https://i.pinimg.com/originals/00/11/22/orphan.jpg",
      imageWidth: 600,
      imageHeight: 800,
      thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4",
      source: "Pinterest",
      domain: "www.pinterest.com",
      position: 4,
    },
    {
      // Image host not allowlisted, thumb host allowlisted: kept with the thumb as image.
      title: "Menu board on a personal blog, pinned",
      imageUrl: "https://images.someblog.example/menu.jpg",
      imageWidth: 1200,
      imageHeight: 900,
      thumbnailUrl: "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcR5",
      thumbnailWidth: 276,
      thumbnailHeight: 207,
      source: "Pinterest",
      domain: "uk.pinterest.com",
      link: "https://uk.pinterest.com/pin/999/",
      position: 5,
    },
    {
      // Neither host allowlisted: dropped.
      title: "Unknown hosts",
      imageUrl: "https://cdn.random.example/a.jpg",
      thumbnailUrl: "https://thumbs.random.example/a.jpg",
      source: "Pinterest",
      domain: "www.pinterest.com",
      link: "https://www.pinterest.com/pin/555/",
      position: 6,
    },
    {
      // Lookalike host: substring of an allowlisted host must not pass.
      title: "Lookalike",
      imageUrl: "https://i.pinimg.com.evil.example/x.jpg",
      thumbnailUrl: "https://encrypted-tbn0.gstatic.com.evil.example/x",
      source: "Pinterest",
      domain: "www.pinterest.com",
      link: "https://www.pinterest.com/pin/556/",
      position: 7,
    },
    {
      // Source page on a lookalike domain: dropped.
      title: "Not Pinterest",
      imageUrl: "https://i.pinimg.com/originals/fa/ke/fake.jpg",
      thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8",
      source: "notpinterest",
      domain: "notpinterest.com",
      link: "https://notpinterest.com/pin/1/",
      position: 8,
    },
    {
      // Same image as result 1 pinned again: deduped.
      title: "Brutalist bakery menu poster (repin)",
      imageUrl: "https://i.pinimg.com/originals/aa/bb/cc/aabbcc0011.jpg",
      imageWidth: 736,
      imageHeight: 1104,
      thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9",
      source: "Pinterest",
      domain: "www.pinterest.com",
      link: "https://www.pinterest.com/pin/888/",
      position: 9,
    },
    {
      // On the takedown list in tests: dropped when the matcher blocks it.
      title: "Taken down shot",
      imageUrl: "https://cdn.dribbble.com/userupload/777/file/original-down.png",
      imageWidth: 800,
      imageHeight: 600,
      thumbnailUrl: "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcR10",
      source: "Dribbble",
      domain: "dribbble.com",
      link: "https://dribbble.com/shots/777-Taken-down",
      position: 10,
    },
    {
      // Plain http image and javascript link: dropped.
      title: "Bad link",
      imageUrl: "http://i.pinimg.com/originals/http.jpg",
      thumbnailUrl: "data:image/png;base64,AAAA",
      source: "Pinterest",
      domain: "www.pinterest.com",
      link: "javascript:alert(1)",
      position: 11,
    },
  ],
  credits: 2,
};
