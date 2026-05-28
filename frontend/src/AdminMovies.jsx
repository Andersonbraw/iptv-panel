const filteredMovies =
  useMemo(() => {
    const grouped = {}

    movies.forEach(movie => {
      let cleanTitle =
        movie.title || ''

      cleanTitle = cleanTitle
        .replace(
          /S\d{1,2}E\d{1,2}/gi,
          ''
        )
        .replace(
          /TEMPORADA\s?\d+/gi,
          ''
        )
        .replace(
          /EPISODIO\s?\d+/gi,
          ''
        )
        .replace(
          /\(\d{4}\)/g,
          ''
        )
        .replace(
          /\[\d{4}\]/g,
          ''
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim()

      const normalizedTitle =
        normalize(cleanTitle)

      const category =
        normalize(
          movie.category || ''
        )

      const matchesSearch =
        normalizedTitle.includes(
          normalize(search)
        )

      const matchesFilter =
        filter === 'Todos'
          ? true
          : category.includes(
              normalize(filter)
            )

      if (
        !matchesSearch ||
        !matchesFilter
      ) {
        return
      }

      if (
        !grouped[normalizedTitle]
      ) {
        grouped[
          normalizedTitle
        ] = {
          ...movie,
          title: cleanTitle,
          episodes: 1
        }
      } else {
        grouped[
          normalizedTitle
        ].episodes++
      }
    })

    return Object.values(grouped)
  }, [movies, search, filter])