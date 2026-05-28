const filteredMovies =
  useMemo(() => {
    return movies.filter(
      movie => {
        const title =
          normalize(
            movie.title || ''
          )

        const category =
          normalize(
            movie.category ||
              ''
          )

        const matchesSearch =
          title.includes(
            normalize(search)
          )

        const matchesFilter =
          filter === 'Todos'
            ? true
            : category.includes(
                normalize(
                  filter
                )
              )

        return (
          matchesSearch &&
          matchesFilter
        )
      }
    )
  }, [movies, search, filter])