package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/vpnetscape/client/service/autoclean"
	"github.com/vpnetscape/client/service/profile"
)

func stopPost(c *gin.Context) {
	prfls := profile.GetProfiles()
	for _, prfl := range prfls {
		prfl.Stop()
	}

	autoclean.CheckAndCleanWatch()

	c.JSON(200, nil)
}
